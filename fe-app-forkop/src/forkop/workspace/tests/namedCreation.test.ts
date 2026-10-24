// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { configureNamedSectionCreation } from '../namedCreation';
import { nativeLuciHarness } from './fixtures/nativeLuciHarness';
import { readFileSync } from 'node:fs';
afterEach(() => document.body.replaceChildren());
const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
function fixture() {
  const native = nativeLuciHarness();
  const entries: Record<string, Record<string, string>> = {
    section_1: { label: 'Existing', ref: 'server_1' },
  };
  const original = JSON.stringify(entries);
  const opened: Array<{ id: string; label: string }> = [];
  const section = {
    anonymous: false,
    sectiontype: 'section',
    map: {
      config: 'forkop',
      readonly: false,
      addedSection: undefined as string | undefined,
      data: {
        get: (_config: string, id: string, option?: string) =>
          option ? entries[id]?.[option] : entries[id],
        add: (_config: string, type: string, id: string) => {
          if (!id || entries[id]) throw Error('collision');
          entries[id] = { '.type': type };
          return id;
        },
        set: (_config: string, id: string, key: string, value: string) =>
          (entries[id][key] = value),
        remove: (_config: string, id: string) => delete entries[id],
      },
    },
    getPreviousModalMap: () => null,
    super: () => undefined,
    handleAdd: native.grid.handleAdd,
    renderMoreOptionsModal: (id: string) => {
      opened.push({ id, label: entries[id].label });
      return Promise.resolve();
    },
    renderSectionAdd: (_extra?: string) => document.createElement('div'),
  };
  configureNamedSectionCreation(section, 'Новое правило', 'Добавить правило');
  const root = section.renderSectionAdd('cbi-tblsection-create');
  document.body.append(root);
  return { native, section, root, entries, opened, original };
}
it('creates a unique named section with a friendly editable label through native handleAdd', async () => {
  const { section, root, opened, entries } = fixture();
  expect(root.querySelectorAll('button')).toHaveLength(1);
  expect(root.querySelector('input')).toBeNull();
  root.querySelector('button')!.click();
  await tick();
  expect(opened).toEqual([{ id: 'section_2', label: 'Новое правило' }]);
  expect(section.anonymous).toBe(false);
  expect(section.map.addedSection).toBe('section_2');
  entries.section_2.label = 'My route';
  await section.renderMoreOptionsModal('section_2');
  expect(entries.section_2.label).toBe('My route');
  expect(entries.section_1).toEqual({ label: 'Existing', ref: 'server_1' });
});
it('uses native cancellation to remove only the newly added section and keeps existing identity/references', async () => {
  const { native, section, root, entries, original } = fixture();
  root.querySelector('button')!.click();
  await tick();
  native.grid.handleModalCancel.call(section, {}, new Event('click'));
  expect(JSON.stringify(entries)).toBe(original);
  expect(section.map.addedSection).toBeUndefined();
});
it('blocks creation in read-only maps including a permission change after render', async () => {
  const { section, root, entries, original } = fixture();
  section.map.readonly = true;
  root.querySelector('button')!.click();
  await tick();
  expect(JSON.stringify(entries)).toBe(original);
  const readonly = section.renderSectionAdd();
  expect(readonly.querySelector('button')!.disabled).toBe(true);
});
it('removes only the newly created draft and native marker when opening the modal fails, then retries safely', async () => {
  const { section, entries, original } = fixture();
  let fail = true;
  section.renderMoreOptionsModal = async () => {
    if (fail) throw Error('modal load failed');
  };
  configureNamedSectionCreation(section, 'Новое правило', 'Добавить правило');
  const root = section.renderSectionAdd();
  document.body.append(root);
  root.querySelector('button')!.click();
  await tick();
  expect(root.textContent).toContain('Не удалось открыть редактор');
  expect(JSON.stringify(entries)).toBe(original);
  expect(section.map.addedSection).toBeUndefined();
  fail = false;
  root.querySelector('button')!.click();
  await tick();
  expect(entries.section_2.label).toBe('Новое правило');
  expect(entries.section_3).toBeUndefined();
});
it('preserves the native asynchronous inbound creation defaults and cancellation with a friendly name', async () => {
  const { native, section, entries, opened } = fixture();
  section.sectiontype = 'server';
  const source = readFileSync(
    '../luci-app-forkop/htdocs/luci-static/resources/view/forkop/server.js',
    'utf8',
  );
  const module = new Function(
    'baseclass',
    'form',
    'uci',
    'main',
    'rpc',
    'dom',
    '_',
    source,
  )(
    { extend: (value: unknown) => value },
    {
      GridSection: {
        prototype: {
          ...native.grid,
          renderMoreOptionsModal: section.renderMoreOptionsModal,
        },
      },
    },
    section.map.data,
    { FORKOP_UCI_PACKAGE: 'forkop' },
    { declare: () => async () => [] },
    native.dom,
    (text: string) => text,
  );
  module.configureServerSection(section, {
    loadCapabilities: async () => ({ singBoxTailscale: true }),
  });
  configureNamedSectionCreation(
    section,
    'Входящее подключение',
    'Добавить входящее подключение',
  );
  const root = section.renderSectionAdd();
  document.body.append(root);
  root.querySelector('button')!.click();
  await tick();
  expect(opened).toEqual([{ id: 'server_1', label: 'Входящее подключение' }]);
  expect(entries.server_1.enabled).toBe('1');
  expect(entries.server_1.protocol).toBe('tailscale');
  expect(section.anonymous).toBe(false);
  // Server override delegates to the same native cancellation contract.
  (
    section as typeof section & {
      handleModalCancel: (map: unknown, ev: Event) => unknown;
    }
  ).handleModalCancel({ section: 'server_1' }, new Event('click'));
  expect(entries.server_1).toBeUndefined();
  expect(entries.section_1.ref).toBe('server_1');
});
