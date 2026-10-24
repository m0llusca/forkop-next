import { readFileSync } from 'node:fs';
// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import * as workflows from '../workflows';
import { configureNamedSectionCreation } from '../../workspace/namedCreation';
import { nativeLuciHarness } from '../../workspace/tests/fixtures/nativeLuciHarness';
const tick = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
afterEach(() => document.body.replaceChildren());
function fixture() {
  const native = nativeLuciHarness();
  const entries: Record<string, Record<string, string>> = {
    section_1: { label: 'Existing', subscription_url: 'existing_child' },
  };
  const map = document.createElement('div');
  map.className = 'cbi-map';
  const tabs = document.createElement('div');
  tabs.className = 'cbi-map-tabbed';
  const dashboard = document.createElement('section');
  dashboard.dataset.tab = 'dashboard';
  dashboard.append('Servers');
  const rules = document.createElement('section');
  rules.dataset.tab = 'section';
  const draft = document.createElement('input');
  draft.value = 'retained';
  rules.append(draft);
  tabs.append(dashboard, rules);
  map.append(tabs);
  document.body.append(map);
  native.tabs.initTabGroup(tabs.childNodes);
  let modal: HTMLElement;
  const opened: string[] = [];
  const section = {
    sectiontype: 'section',
    map: {
      config: 'forkop',
      addedSection: undefined as string | undefined,
      data: {
        get: (_c: string, id: string) => entries[id],
        set: (_c: string, id: string, k: string, v: string) =>
          (entries[id][k] = v),
        remove: (_c: string, id: string) => delete entries[id],
        add: (_c: string, _t: string, id: string) => {
          entries[id] = {};
          return id;
        },
      },
    },
    getPreviousModalMap: () => null,
    super: () => undefined,
    handleAdd: native.grid.handleAdd,
    renderMoreOptionsModal: async (id: string) => {
      opened.push(id);
      modal = document.createElement('div');
      modal.className = 'cbi-map';
      const group = document.createElement('div');
      const settings = document.createElement('div');
      settings.dataset.tab = 'settings';
      const conditions = document.createElement('div');
      conditions.dataset.tab = 'conditions';
      for (const key of [
        'selector_proxy_links',
        'subscription_url',
        'interfaces',
        'outbound_jsons',
        'urltest',
        'priority_group',
        'mixed_proxy_enabled',
        'domain',
      ]) {
        const field = document.createElement('div');
        field.id = `cbid.forkop.${id}.${key}`;
        const input = document.createElement(
          key === 'domain' ? 'textarea' : 'input',
        );
        field.append(input);
        (key === 'domain' ? conditions : settings).append(field);
      }
      group.append(settings, conditions);
      modal.append(group);
      document.body.append(modal);
      native.tabs.initTabGroup(group.childNodes);
      return modal;
    },
    getActiveModalMap: () => modal,
    renderSectionAdd: () => document.createElement('div'),
    renderContents: () => rules,
  };
  configureNamedSectionCreation(section, 'Новое правило', 'Добавить правило');
  rules.append(section.renderSectionAdd());
  workflows.configureRuleWorkflow(section);
  section.renderContents();
  return {
    map,
    dashboard,
    rules,
    section,
    entries,
    opened,
    draft,
    getModal: () => modal,
  };
}
it('creates through native named handleAdd, focuses subscription and keeps all six sources and other drafts', async () => {
  const f = fixture();
  expect(
    workflows.navigateToRule(f.dashboard, {
      kind: 'create',
      option: 'subscription_url',
    }),
  ).toBe(true);
  await tick();
  expect(f.opened).toEqual(['section_2']);
  expect(f.section.map.addedSection).toBe('section_2');
  expect(f.entries.section_1.subscription_url).toBe('existing_child');
  expect(f.draft.value).toBe('retained');
  expect(document.activeElement?.parentElement?.id).toBe(
    'cbid.forkop.section_2.subscription_url',
  );
  expect(f.getModal().querySelectorAll('input')).toHaveLength(7);
  expect(f.rules.textContent).toContain('Вернуться к выбору узла');
});
it('opens the exact existing rule and native Conditions tab without creating or replacing source fields', async () => {
  const f = fixture();
  workflows.navigateToRule(f.dashboard, { kind: 'site', section: 'section_1' });
  await tick();
  expect(f.opened).toEqual(['section_1']);
  expect(Object.keys(f.entries)).toEqual(['section_1']);
  expect(
    f
      .getModal()
      .querySelector('div[data-tab="conditions"]')
      ?.getAttribute('data-tab-active'),
  ).toBe('true');
  expect(document.activeElement?.tagName).toBe('TEXTAREA');
});
it('focuses a requested proxy field and preserves editor navigation errors locally', async () => {
  const f = fixture();
  workflows.navigateToRule(f.dashboard, {
    kind: 'edit',
    section: 'section_1',
    option: 'mixed_proxy_enabled',
  });
  await tick();
  expect(document.activeElement?.parentElement?.id).toBe(
    'cbid.forkop.section_1.mixed_proxy_enabled',
  );
  f.section.renderMoreOptionsModal = async () => {
    throw Error('offline');
  };
  workflows.navigateToRule(f.dashboard, { kind: 'edit', section: 'section_1' });
  await tick();
  expect(f.rules.textContent).toContain('Не удалось открыть');
});
it('starts native connection creation from the Home empty state', async () => {
  const { renderNextPanel } = await import('../render');
  const f = fixture();
  const root = renderNextPanel(
    async () => ({ success: true, data: { sections: [] } }),
    async () => ({ success: true, data: [] }),
  );
  f.dashboard.append(root);
  await tick();
  [...root.querySelectorAll('button')]
    .find((b) => b.textContent === 'Добавить подключение')!
    .click();
  await tick();
  expect(f.opened).toEqual(['section_2']);
});
it('returns to the exact rendered connection group after saving and applying', async () => {
  const f = fixture();
  workflows.navigateToRule(f.dashboard, { kind: 'edit', section: 'section_1' });
  await tick();
  f.getModal().remove();
  const group = document.createElement('section');
  group.dataset.connectionSection = 'section_1';
  f.dashboard.append(group);
  [...f.rules.querySelectorAll('button')]
    .find((b) => b.textContent === 'Вернуться к выбору узла')!
    .click();
  expect(document.activeElement).toBe(group);
  expect(f.dashboard.dataset.tabActive).toBe('true');
  expect(f.entries.section_1.subscription_url).toBe('existing_child');
});

it('wires the actual native Servers add button to the exact creation flow', async () => {
  const f = fixture();
  const field = { cfgvalue: () => document.createElement('div') };
  const source = readFileSync(
    '../luci-app-forkop/htdocs/luci-static/resources/view/forkop/dashboard.js',
    'utf8',
  );
  const module = new Function('baseclass', 'form', 'main', source)(
    { extend: (v: unknown) => v },
    { DummyValue: 'dummy' },
    {
      ...workflows,
      DashboardTab: {
        initController: () => {},
        render: () => document.createElement('div'),
      },
    },
  );
  module.createDashboardContent({ option: () => field });
  f.dashboard.append(field.cfgvalue());
  [...f.dashboard.querySelectorAll('button')]
    .find((b) => b.textContent === 'Добавить подключение')!
    .click();
  await tick();
  expect(f.opened).toEqual(['section_2']);
  expect(document.activeElement?.parentElement?.id).toBe(
    'cbid.forkop.section_2.subscription_url',
  );
});
it('shows the unapplied or unavailable group explanation on Servers after returning there', async () => {
  const f = fixture();
  workflows.navigateToRule(f.dashboard, { kind: 'create' });
  await tick();
  f.getModal().remove();
  [...f.rules.querySelectorAll('button')]
    .find((b) => b.textContent === 'Вернуться к выбору узла')!
    .click();
  expect(f.dashboard.textContent).toContain('после применения');
});
it.each([
  { kind: 'site' as const },
  { kind: 'edit' as const, option: 'mixed_proxy_enabled' },
])(
  'does not show source-import guidance for $kind $option navigation',
  async (destination) => {
    const f = fixture();
    workflows.navigateToRule(f.dashboard, {
      ...destination,
      section: 'section_1',
    });
    await tick();
    expect(f.rules.textContent).not.toContain('После разбора источников');
    expect(
      [...f.rules.querySelectorAll('button')].find(
        (b) => b.textContent === 'Вернуться к выбору узла',
      )!.hidden,
    ).toBe(true);
  },
);
