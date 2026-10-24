// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { workspaceStyles } from '../styles';
import { nextStyles } from '../../next/styles';

// Focused native/Atlas cascade declarations from the public captured styles.
// Important host surface/control variants exercise embedded-theme isolation.
const hostStyles = `
body.atlas-theme .cbi-map,body.atlas-theme .cbi-section,body.atlas-theme .modal{background:#061d2c!important;color:#e7f0fb!important}
body.atlas-theme input,body.atlas-theme select,body.atlas-theme textarea{background:#092637!important;color:#e7f0fb!important}
.cbi-value{display:flex;flex-wrap:wrap;margin-bottom:18px;align-items:baseline}
.cbi-value label.cbi-value-title{padding-top:6px;font-size:13px;line-height:18px;flex:0 0 180px;text-align:right}
input,textarea,select,.cbi-select,.cbi-dropdown:not(.btn):not(.cbi-button){width:210px}
.td.cbi-section-actions > :not(.cbi-dropdown) > *{flex:1 1 4em;margin:0 1px}
.td.cbi-value-field .cbi-button{width:100%}
@media (max-width:720px){.cbi-section-table-titles{display:none}.td.cbi-value-field{flex-basis:100%}.td.cbi-section-actions{flex-basis:100%}}
`;
function surface(width = 1280, theme = 'light') {
  (
    window as unknown as {
      happyDOM: {
        setWindowSize(size: { width: number; height: number }): void;
      };
    }
  ).happyDOM.setWindowSize({ width, height: 900 });
  document.body.className = 'atlas-theme';
  const style = document.createElement('style');
  style.dataset.visualTest = '';
  style.textContent = nextStyles + workspaceStyles + hostStyles;
  document.head.append(style);
  document.body.innerHTML = `<div id="cbi-forkop" class="cbi-map fkp-workspace" data-theme="${theme}"><section class="cbi-section"><div class="cbi-value"><label class="cbi-value-title">Параметр</label><div class="cbi-value-field"><input type="text" value="unsaved"><div class="cbi-value-description">Описание</div></div></div></section></div><div id="modal_overlay"><div class="modal cbi-modal fkp-workspace-modal" data-theme="${theme}"><div class="cbi-map"><section class="cbi-section"><div class="cbi-value"><label class="cbi-value-title">Параметр</label><div class="cbi-value-field"><select><option>Value</option></select></div></div></section></div></div></div>`;
  return document.querySelector<HTMLElement>('.fkp-workspace')!;
}
afterEach(() => {
  document.body.replaceChildren();
  document.body.className = '';
  document.head
    .querySelectorAll('[data-visual-test]')
    .forEach((node) => node.remove());
});

it('fits actual native widget wrappers', () => {
  const root = surface();
  const field = root.querySelector('.cbi-value-field')!;
  field.innerHTML =
    '<div id="cbid.forkop.settings.dns_type"><select><option>Длинное название настройки</option></select></div>';
  expect(getComputedStyle(field.querySelector('select')!).width).toBe('100%');
});
it('shows only the active native modal tab', () => {
  surface();
  const modal = document.querySelector('.fkp-workspace-modal')!;
  const panes = document.createElement('div');
  panes.className = 'cbi-section-node-tabbed';
  panes.innerHTML =
    '<div data-tab="settings" data-tab-active="true">Настройки</div><div data-tab="conditions" data-tab-active="false">Условия</div>';
  modal.append(panes);
  expect(getComputedStyle(panes.children[0]).display).not.toBe('none');
  expect(getComputedStyle(panes.children[1]).display).toBe('none');
});

it.each([
  ['light', '#f6f7f8', '#17252d', '#fff'],
  ['dark', '#16232b', '#eef4f6', '#21333e'],
])(
  'keeps the %s workspace and marked modal readable against important host colors',
  (theme, bg, fg, field) => {
    const root = surface(1280, theme);
    const modal = document.querySelector<HTMLElement>('.fkp-workspace-modal')!;
    for (const node of [root, modal]) {
      expect(getComputedStyle(node).backgroundColor).toBe(bg);
      expect(getComputedStyle(node).color).toBe(fg);
      const input = node.querySelector('input,select')!;
      expect(getComputedStyle(input).backgroundColor).toBe(field);
      expect(getComputedStyle(input).color).toBe(fg);
      expect(getComputedStyle(node.querySelector('.cbi-section')!).color).toBe(
        fg,
      );
    }
  },
);

it.each([1280, 390])(
  'left-aligns native form labels and fits controls into available space at %i px',
  (width) => {
    const root = surface(width);
    for (const row of document.querySelectorAll('.cbi-value')) {
      expect(
        getComputedStyle(row.querySelector('.cbi-value-title')!).textAlign,
      ).toBe('left');
      expect(getComputedStyle(row).marginBottom).toBe('0px');
      const control = row.querySelector('input,select')!;
      expect(getComputedStyle(control).width).toBe('100%');
      expect(getComputedStyle(control).minHeight).toBe('42px');
      if (width < 720) expect(getComputedStyle(row).display).toBe('block');
    }
    expect(root.querySelector<HTMLInputElement>('input')!.value).toBe(
      'unsaved',
    );
  },
);

function nativeRuleTable(root: HTMLElement) {
  // Native TableSection named row and GridSection field/action markup.
  root.querySelector('.cbi-section')!.id = 'cbi-forkop-section';
  root.querySelector('.cbi-section')!.innerHTML =
    `<table class="table cbi-section-table"><thead><tr class="tr cbi-section-table-titles"><th>Name</th><th>Включить</th><th>Действие</th><th></th></tr></thead><tbody><tr class="tr cbi-section-table-row" data-title="Основное подключение"><td class="td cbi-value-field cbi-section-table-titles">Основное подключение</td><td class="td cbi-value-field" data-title="Включить" data-widget="CBI.FlagValue"><input type="checkbox" checked></td><td class="td cbi-value-field" data-title="Действие" data-widget="CBI.DummyValue">Подключение</td><td class="td cbi-section-table-cell nowrap cbi-section-actions" style="width:160px;min-width:160px"><div><button class="cbi-button drag-handle">Drag</button><button class="cbi-button cbi-button-edit">Изменить</button><button class="cbi-button cbi-button-remove">Удалить</button></div></td></tr></tbody></table>`;
}
it('keeps desktop rule actions inline without forcing buttons to fill the action column', () => {
  const root = surface();
  nativeRuleTable(root);
  const actions = root.querySelector('.cbi-section-actions')!;
  expect(getComputedStyle(actions.firstElementChild!).flexWrap).toBe('wrap');
  for (const button of actions.querySelectorAll('button'))
    expect(getComputedStyle(button).flexGrow).toBe('0');
});
it('stacks native mobile rule rows with visible name, labeled cells and reachable actions', () => {
  const root = surface(390);
  nativeRuleTable(root);
  expect(
    parseFloat(getComputedStyle(root.querySelector('table')!).minWidth),
  ).toBe(0);
  expect(
    getComputedStyle(root.querySelector('tbody .cbi-section-table-titles')!)
      .display,
  ).toBe('block');
  expect(getComputedStyle(root.querySelector('td[data-title]')!).display).toBe(
    'grid',
  );
  expect(
    parseFloat(
      getComputedStyle(root.querySelector('.cbi-section-actions')!).minWidth,
    ),
  ).toBe(0);
  expect(
    getComputedStyle(root.querySelector('.cbi-section-actions')!).width,
  ).toBe('100%');
});

it('uses full-width area status and balanced desktop tools', () => {
  const root = surface();
  root.innerHTML =
    '<section class="fkp-next" data-area="devices"><p class="fkp-next-status">Status</p><div class="fkp-next-content"><div class="fkp-next-tools"><section>Devices</section><section>Gaming</section></div></div></section><section class="fkp-next" data-area="settings"><div class="fkp-next-content"><section>Profiles</section><section class="fkp-next-compatibility">Compatibility</section><div class="fkp-next-tools"><section>Import/export</section></div></div></section>';
  expect(
    getComputedStyle(root.querySelector('.fkp-next-status')!).maxWidth,
  ).toBe('none');
  expect(
    getComputedStyle(root.querySelector('[data-area=devices] .fkp-next-tools')!)
      .gridTemplateColumns,
  ).toBe('repeat(2,minmax(0,1fr))');
  expect(
    getComputedStyle(
      root.querySelector('[data-area=settings] .fkp-next-tools')!,
    ).gridTemplateColumns,
  ).toBe('minmax(0,1fr)');
  expect(
    getComputedStyle(
      root.querySelector('[data-area=settings] .fkp-next-compatibility')!,
    ).gridColumn,
  ).toBe('auto');
});
