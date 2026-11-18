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

it('neutralizes OpenWrt cascade.css button mid-word breaks and GridSection 33% header widths', () => {
  const cascade = document.createElement('style');
  cascade.textContent = 'button{word-break:break-all}.btn{white-space:nowrap}';
  document.head.prepend(cascade);
  try {
    const root = surface();
    nativeRuleTable(root);
    const ths = root.querySelectorAll('thead .cbi-section-table-titles th');
    (ths[1] as HTMLElement).style.width = '33%';
    (ths[2] as HTMLElement).style.width = '33%';
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'Сгенерировать анонимный Cloudflare WARP';
    root.append(btn);
    expect(getComputedStyle(btn).wordBreak).toBe('normal');
    expect(getComputedStyle(btn).whiteSpace).toBe('normal');
    expect(getComputedStyle(ths[1]!).width).toBe('96px');
    expect(getComputedStyle(ths[1]!).whiteSpace).toBe('nowrap');
    expect(getComputedStyle(ths[2]!).width).toBe('auto');
  } finally {
    cascade.remove();
  }
});

it('groups overview controls into a single hero action bar, aligns rule actions in one bar, and removes cascade.css description icons', async () => {
  const { mountForkopWorkspace } = await import('../render');
  const { renderNextPanel } = await import('../../next/render');
  const { nextStyles } = await import('../../next/styles');
  const { configureRuleOrder, normalizeNamedSectionTable } = await import(
    '../rules'
  );
  const nextStyle = document.createElement('style');
  nextStyle.textContent = nextStyles;
  const cascade = document.createElement('style');
  cascade.textContent =
    '.cbi-value-description:not(:empty)::before{content:"?";position:absolute;left:-1.25em}.cbi-section-create>*{flex:1 1 auto}';
  document.head.prepend(cascade);
  document.head.append(nextStyle);
  try {
    const root = surface();
    root.innerHTML =
      '<ul class="cbi-tabmenu"><li class="cbi-tab" data-tab="next"><a>Главная</a></li><li class="cbi-tab-disabled" data-tab="section"><a>Правила</a></li></ul><div class="cbi-map-tabbed"><section class="cbi-section" data-tab="next" data-tab-active="true"></section><section class="cbi-section" id="cbi-forkop-section" data-tab="section"></section></div>';
    mountForkopWorkspace(root);
    expect(root.querySelector('.fkp-workspace-theme-toggle')).toBeNull();
    expect(root.dataset.activeTab).toBe('next');
    expect(
      getComputedStyle(root.querySelector('.fkp-workspace-title')!).display,
    ).toBe('none');
    document.documentElement.setAttribute('data-darkmode', 'true');
    await new Promise((r) => setTimeout(r, 0));
    expect(root.dataset.theme).toBe('dark');
    document.documentElement.setAttribute('data-darkmode', 'false');
    await new Promise((r) => setTimeout(r, 0));
    expect(root.dataset.theme).toBe('light');
    document.documentElement.removeAttribute('data-darkmode');

    const overview = renderNextPanel(
      async () => ({ success: true, data: {} }),
      async () => ({
        success: true,
        data: [
          {
            sectionName: 'main',
            code: 'main-out',
            displayName: 'Основной маршрут',
            outbounds: [
              {
                code: 'nl-1',
                displayName: 'NL Amsterdam 01',
                selected: true,
                latency: 28,
              },
            ],
          },
        ],
      }),
      {
        workspace: true,
        readRuntime: async () => ({ running: true }),
        changeService: async () => ({ success: true }),
      },
    );
    root.querySelector('[data-tab="next"]')!.append(overview);
    await new Promise((r) => setTimeout(r, 0));

    const heroActions = overview.querySelector('.fkp-next-hero-actions');
    expect(heroActions).not.toBeNull();
    expect(getComputedStyle(heroActions!).display).toBe('flex');
    const heroTexts = [...heroActions!.querySelectorAll('button')].map(
      (b) => b.textContent,
    );
    expect(heroTexts).toEqual(
      expect.arrayContaining([
        'Изменить сервер',
        'Отключить сервис',
        'Обновить данные',
      ]),
    );

    const ruleSection = root.querySelector<HTMLElement>('#cbi-forkop-section')!;
    ruleSection.innerHTML =
      '<table class="table cbi-section-table"><thead><tr class="tr cbi-section-table-titles named" data-title="Name"><th class="th cbi-section-table-cell">Включить</th><th class="th cbi-section-table-cell">Действие</th><th class="th cbi-section-actions"></th></tr></thead><tbody><tr class="tr cbi-section-table-row" data-sid="main" data-title="Основной маршрут"><td class="td cbi-value-field" data-title="Включить"><input type="checkbox" checked></td><td class="td cbi-value-field" data-title="Действие">Через подключение</td><td class="td cbi-section-actions"><div><button class="cbi-button drag-handle">☰</button><button class="cbi-button cbi-button-edit">Изменить</button><button class="cbi-button cbi-button-remove">Удалить</button></div></td></tr></tbody></table>';
    normalizeNamedSectionTable(ruleSection, 'Правило');
    expect(
      ruleSection.querySelector('thead tr > :first-child')?.textContent,
    ).toBe('Правило');
    expect(
      ruleSection.querySelector('tbody tr > td.cbi-section-table-titles')
        ?.textContent,
    ).toBe('Основной маршрут');

    configureRuleOrder(ruleSection, () => true);
    const row = ruleSection.querySelector<HTMLElement>('tbody tr')!;
    const actionBar = row.querySelector('.fkp-rule-actions-bar');
    expect(actionBar).not.toBeNull();
    expect(actionBar!.querySelector('[data-rule-order="up"]')).not.toBeNull();
    expect(actionBar!.querySelector('.cbi-button-edit')).not.toBeNull();
    expect(
      getComputedStyle(ruleSection.querySelector('tbody tr > :nth-child(2)')!)
        .textAlign,
    ).toBe('center');

    const desc = document.createElement('div');
    desc.className = 'cbi-value-description';
    desc.textContent = 'Описание настройки';
    const createWrap = document.createElement('div');
    createWrap.className = 'cbi-section-create';
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Добавить правило';
    createWrap.append(addBtn);
    const { renderSymptomGuide } = await import(
      '../../tabs/diagnostic/symptomGuide'
    );
    const diag = renderSymptomGuide(async () => ({ success: true, data: {} }));
    root.append(desc, createWrap, diag);
    expect(getComputedStyle(addBtn).flexGrow).toBe('0');
    const tspuControls = diag.querySelector<HTMLElement>('.fkp-tspu-controls')!;
    const tspuPresets = diag.querySelector<HTMLElement>('.fkp-tspu-presets')!;
    expect(tspuControls.children[0]?.tagName).toBe('LABEL');
    expect(getComputedStyle(tspuControls).alignItems).toBe('end');
    expect(getComputedStyle(tspuPresets).gridColumn).toBe('1 / -1');
  } finally {
    cascade.remove();
    nextStyle.remove();
  }
});

it('themes sibling .cbi-page-actions, keeps .fkp-next checkboxes crisp, aligns #cbi-forkop-server and mobile rule actions, and structures remaining workspace panes', async () => {
  const { styles: monitoringStyles } = await import(
    '../../tabs/monitoring/styles'
  );
  const cascade = document.createElement('style');
  cascade.textContent =
    '.cbi-page-actions{background:#f5f5f5;text-align:right}input[type="checkbox"]{appearance:none;width:14px;height:14px}.cbi-dropdown.btn > ul:not(.dropdown){margin:0 0 0 13px!important}.td.cbi-section-actions > :not(.cbi-dropdown) > *{flex:1 1 4em}' +
    monitoringStyles;
  document.head.prepend(cascade);
  try {
    const { mountForkopWorkspace } = await import('../render');
    const { renderAdvancedPanel } = await import('../../next/advanced');
    const root = surface(1280, 'light');
    root.innerHTML =
      '<ul class="cbi-tabmenu"><li class="cbi-tab" data-tab="settings"><a>Основные</a></li></ul><div class="cbi-map-tabbed"><section class="cbi-section" data-tab="settings" data-tab-active="true"></section></div>';
    const footer = document.createElement('div');
    footer.className = 'cbi-page-actions';
    footer.innerHTML =
      '<div class="cbi-dropdown btn cbi-button cbi-button-apply"><ul><li>Save & Apply</li></ul><span class="open">▾</span></div><button class="cbi-button cbi-button-save">Сохранить</button><button class="cbi-button cbi-button-reset">Reset</button>';
    root.after(footer);
    mountForkopWorkspace(root);

    expect(getComputedStyle(footer).display).toBe('flex');
    expect(getComputedStyle(footer).backgroundColor).toBe('#fff');
    expect(
      getComputedStyle(
        footer.querySelector('.cbi-dropdown.cbi-button-apply > ul')!,
      ).marginLeft,
    ).toBe('0px');

    document.documentElement.setAttribute('data-darkmode', 'true');
    await new Promise((r) => setTimeout(r, 0));
    expect(footer.dataset.theme).toBe('dark');
    expect(getComputedStyle(footer).backgroundColor).toBe('#21333e');
    expect(
      getComputedStyle(footer.querySelector('.cbi-button-apply')!)
        .backgroundColor,
    ).toBe('#8bd6c8');
    expect(
      getComputedStyle(footer.querySelector('.cbi-button-reset')!).color,
    ).toBe('#ffb4b8');

    document.documentElement.setAttribute('data-darkmode', 'false');
    await new Promise((r) => setTimeout(r, 0));
    expect(footer.dataset.theme).toBe('light');
    expect(getComputedStyle(footer).backgroundColor).toBe('#fff');
    document.documentElement.removeAttribute('data-darkmode');

    const ruleTools = renderAdvancedPanel(
      async () => ({ success: true, data: {} }),
      undefined,
      false,
      'rules',
    );
    const smartCheckLabel = ruleTools.querySelector(
      'input[name="smart_detect_enabled"]',
    )?.parentElement;
    expect(smartCheckLabel?.firstElementChild?.tagName).toBe('INPUT');

    root.innerHTML = `
      <section class="cbi-section" data-tab="devices" data-tab-active="true">
        <h3>Маршруты устройств</h3>
        <section class="fkp-next" data-area="devices">
          <div class="fkp-next-content">
            <div class="fkp-next-tools">
              <section class="fkp-next-panel">
                <ul><li>192.168.1.55 → PlayStation 5<button type="button">Изменить</button></li></ul>
                <label class="fkp-next-check"><input type="checkbox" checked>Консольный режим</label>
              </section>
            </div>
            <div class="fkp-next-row"><span>example.org → Основной маршрут</span><button type="button">Удалить правило</button></div>
          </div>
        </section>
      </section>
      <div class="fkp-workspace-sources">
        <button type="button">Добавить подключение</button>
        <p>Ссылки и подписки настраиваются внутри правила.</p>
        <button type="button" class="cbi-button">Добавить или изменить источники</button>
        <p role="status"></p>
      </div>
      <details class="fkp-source-evidence"><summary>Состояние источников</summary></details>
      <section class="cbi-section" id="cbi-forkop-server">
        <table class="table cbi-section-table">
          <thead><tr class="tr cbi-section-table-titles"><th>Сервер</th><th style="width:33%">Включить</th><th>Протокол</th><th></th></tr></thead>
          <tbody><tr class="tr cbi-section-table-row" data-sid="srv1"><td>WG Home</td><td><input type="checkbox" checked></td><td>VLESS</td><td class="td cbi-section-actions"><div class="fkp-rule-actions-bar"><div class="fkp-rule-order"><button type="button">↑</button></div><button class="cbi-button">Изменить</button></div></td></tr></tbody>
        </table>
      </section>
      <div class="fkp_monitoring-page">
        <div class="fkp_monitoring-page__table-wrap">
          <table class="fkp_monitoring-page__table"><thead><tr><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>Закрыть</th></tr></thead><tbody><tr><td colspan="7"></td><td><button class="btn fkp_monitoring-page__row-action">×</button></td></tr></tbody></table>
        </div>
      </div>
    `;

    expect(
      getComputedStyle(root.querySelector('.fkp-source-evidence > summary')!)
        .minHeight,
    ).toBe('44px');
    expect(
      getComputedStyle(root.querySelector('.fkp-rule-order')!).flexGrow,
    ).toBe('0');
    expect(
      getComputedStyle(
        root.querySelector(
          '#cbi-forkop-server .cbi-section-actions > div.fkp-rule-actions-bar',
        )!,
      ).flexWrap,
    ).toBe('nowrap');
    expect(
      getComputedStyle(
        root.querySelector('.fkp_monitoring-page__table th:nth-child(8)')!,
      ).width,
    ).toBe('9.5%');

    const check = root.querySelector<HTMLInputElement>(
      '.fkp-next .fkp-next-check input[type="checkbox"]',
    )!;
    expect(getComputedStyle(check).width).toBe('19px');
    expect(getComputedStyle(check).height).toBe('19px');
    expect(getComputedStyle(check).minHeight).toBe('19px');
    expect(getComputedStyle(check).paddingTop).toBe('0px');
    expect(getComputedStyle(check).paddingLeft).toBe('0px');

    expect(
      getComputedStyle(root.querySelector('[data-tab="devices"] > h3')!)
        .display,
    ).toBe('none');
    expect(
      getComputedStyle(root.querySelector('.fkp-workspace-sources')!).display,
    ).toBe('flex');
    expect(
      getComputedStyle(root.querySelector('.fkp-next-tools li')!).display,
    ).toBe('flex');
    expect(getComputedStyle(root.querySelector('.fkp-next-row')!).display).toBe(
      'flex',
    );

    const serverEnableTh = root.querySelector(
      '#cbi-forkop-server thead tr > :nth-child(2)',
    )!;
    expect(getComputedStyle(serverEnableTh).width).toBe('96px');
    expect(getComputedStyle(serverEnableTh).whiteSpace).toBe('nowrap');
    expect(getComputedStyle(serverEnableTh).textAlign).toBe('center');
    expect(
      getComputedStyle(
        root.querySelector('#cbi-forkop-server tr[data-sid] input')!,
      ).display,
    ).toBe('block');

    root.dataset.theme = 'dark';
    expect(
      getComputedStyle(root.querySelector('.fkp_monitoring-page__table-wrap')!)
        .borderRadius,
    ).toBe('12px');
    const rowAction = root.querySelector(
      '.fkp_monitoring-page .btn.fkp_monitoring-page__row-action',
    )!;
    expect(getComputedStyle(rowAction).backgroundColor).toBe('transparent');
    expect(getComputedStyle(rowAction).color).toBe('#ffb4b8');

    const mobileRoot = surface(390, 'light');
    mobileRoot.innerHTML =
      '<section class="cbi-section" id="cbi-forkop-server"><table class="table cbi-section-table"><tbody><tr class="tr cbi-section-table-row" data-sid="srv1"><td class="td cbi-section-actions"><div class="fkp-rule-actions-bar"><button class="cbi-button">Изменить</button></div></td></tr></tbody></table></section>';
    expect(
      getComputedStyle(
        mobileRoot.querySelector(
          '#cbi-forkop-server .cbi-section-actions > div.fkp-rule-actions-bar',
        )!,
      ).justifyContent,
    ).toBe('flex-start');
  } finally {
    cascade.remove();
  }
});
