// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { disposeWorkspaceTools, renderWorkspaceTools } from '../tools';
import { nativeLuciHarness } from './fixtures/nativeLuciHarness';
import type { Request } from '../../next/advanced';

const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
const request = () =>
  vi.fn<Request>(async (action: string) => ({
    success: true,
    data:
      action === 'status'
        ? { versions: {}, sections: [{ name: 'vpn', label: 'Домашний' }] }
        : { items: [] },
  }));
function mapTools(read = request()) {
  const native = nativeLuciHarness();
  const map = document.createElement('div');
  const group = document.createElement('div');
  group.className = 'cbi-map-tabbed';
  const home = document.createElement('section');
  home.dataset.tab = 'next';
  home.dataset.tabTitle = 'Главная';
  home.textContent = 'Обзор';
  const pane = document.createElement('section');
  pane.dataset.tab = 'rule_tools';
  pane.dataset.tabTitle = 'Временные правила';
  const tools = renderWorkspaceTools('rules', read);
  pane.append(tools);
  group.append(home, pane);
  map.append(group);
  document.body.append(map);
  native.tabs.initTabGroup(
    group.childNodes as unknown as NodeListOf<HTMLElement>,
  );
  const visit = () =>
    map
      .querySelector<HTMLAnchorElement>(
        '.cbi-tabmenu [data-tab="rule_tools"] a',
      )!
      .click();
  return { map, pane, tools, read, visit };
}
it('waits for native activation, mounts once and preserves unsaved inputs across native navigation', async () => {
  const { map, tools, read, visit } = mapTools();
  await tick();
  expect(read).not.toHaveBeenCalled();
  visit();
  await tick();
  const field = tools.querySelector<HTMLInputElement>(
    '[name="temporary_domain"]',
  )!;
  field.value = 'draft.example';
  const count = read.mock.calls.length;
  map
    .querySelector<HTMLAnchorElement>('.cbi-tabmenu [data-tab="next"] a')!
    .click();
  visit();
  await tick();
  expect(tools.querySelector('[name="temporary_domain"]')).toBe(field);
  expect(field.value).toBe('draft.example');
  expect(read.mock.calls).toHaveLength(count);
});
it('retries failed data reads without discarding entered values', async () => {
  let fail = true;
  const read = vi.fn<Request>(async (action: string) =>
    fail
      ? { success: false, error: 'offline' }
      : {
          success: true,
          data:
            action === 'status'
              ? { versions: {}, sections: [] }
              : { items: [] },
        },
  );
  const { tools, visit } = mapTools(read);
  visit();
  await tick();
  const field = tools.querySelector<HTMLInputElement>(
    '[name="temporary_domain"]',
  )!;
  field.value = 'draft.example';
  expect(tools.textContent).toContain('Не удалось загрузить');
  fail = false;
  [...tools.querySelectorAll('button')]
    .find((b) => b.textContent === 'Обновить данные')!
    .click();
  await tick();
  expect(tools.textContent).toContain('Временных правил нет.');
  expect(field.value).toBe('draft.example');
});
it('disposes observers before an unvisited map is removed, including a map never connected', async () => {
  const read = request();
  const host = renderWorkspaceTools('rules', read);
  const map = document.createElement('div');
  const pane = document.createElement('section');
  pane.dataset.tab = 'rule_tools';
  pane.dataset.tabActive = 'false';
  pane.append(host);
  map.append(pane);
  await tick();
  disposeWorkspaceTools(map);
  document.body.append(map);
  pane.dataset.tabActive = 'true';
  pane.dispatchEvent(new Event('cbi-tab-active'));
  await tick();
  expect(read).not.toHaveBeenCalled();
});
it('stops an unvisited detached host and never mounts it after reattachment', async () => {
  const { map, pane, read } = mapTools();
  await tick();
  map.remove();
  await tick();
  document.body.append(map);
  pane.dataset.tabActive = 'true';
  pane.dispatchEvent(new Event('cbi-tab-active'));
  await tick();
  expect(read).not.toHaveBeenCalled();
});
