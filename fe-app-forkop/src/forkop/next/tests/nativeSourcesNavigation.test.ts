// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { nativeLuciHarness } from '../../workspace/tests/fixtures/nativeLuciHarness';
afterEach(() => document.body.replaceChildren());
it('links Servers to existing source/rule editors through native activation without replacing the Dashboard or drafts', () => {
  const native = nativeLuciHarness();
  const map = document.createElement('div');
  map.className = 'cbi-map';
  const tabs = document.createElement('div');
  tabs.className = 'cbi-map-tabbed';
  const dashboard = document.createElement('section');
  dashboard.dataset.tab = 'dashboard';
  dashboard.dataset.tabTitle = 'Серверы';
  const rules = document.createElement('section');
  rules.dataset.tab = 'section';
  rules.dataset.tabTitle = 'Правила';
  const draft = document.createElement('input');
  draft.value = 'unsaved-source';
  rules.append(draft);
  const output = document.createElement('div');
  output.textContent = 'Real outgoing selectors';
  const field = { cfgvalue: () => output };
  const source = readFileSync(
    '../luci-app-forkop/htdocs/luci-static/resources/view/forkop/dashboard.js',
    'utf8',
  );
  const module = new Function('baseclass', 'form', 'main', source)(
    { extend: (v: unknown) => v },
    { DummyValue: 'dummy' },
    { DashboardTab: { initController: () => {}, render: () => output } },
  );
  module.createDashboardContent({ option: () => field });
  dashboard.append(field.cfgvalue());
  tabs.append(dashboard, rules);
  map.append(tabs);
  document.body.append(map);
  native.tabs.initTabGroup(tabs.childNodes);
  const link = [...dashboard.querySelectorAll('button')].find(
    (b) => b.textContent === 'Добавить или изменить источники',
  );
  expect(link).toBeDefined();
  link!.click();
  expect(rules.dataset.tabActive).toBe('true');
  expect(draft.value).toBe('unsaved-source');
  expect(dashboard.contains(output)).toBe(true);
});
