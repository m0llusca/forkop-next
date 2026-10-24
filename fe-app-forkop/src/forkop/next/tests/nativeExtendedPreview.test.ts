// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';

it('captures unparsed nested child filters and empty arrays without mutating native owners or secrets', () => {
  const source = readFileSync(
    '../luci-app-forkop/htdocs/luci-static/resources/view/forkop/section.js',
    'utf8',
  );
  const block = source.match(
    /\/\/ Extended preview native snapshot begin[\s\S]*?\/\/ Extended preview native snapshot end/,
  );
  expect(block, 'native preview adapter is missing').not.toBeNull();
  const rows: Record<string, Record<string, unknown>> = {
    main: { '.name': 'main', '.type': 'section', selector_proxy_links: [] },
    u1: {
      '.name': 'u1',
      '.type': 'urltest',
      section: 'main',
      include_outbounds: ['saved'],
      testing_url: 'SECRET',
    },
    p1: {
      '.name': 'p1',
      '.type': 'priority_group',
      section: 'main',
      name: 'Priority',
      health_url: 'SECRET',
    },
    l1: {
      '.name': 'l1',
      '.type': 'priority_level',
      group: 'p1',
      server_name: ['saved'],
      order: '1',
    },
  };
  const write = vi.fn();
  const uci = {
    get: (_p: string, id: string, key?: string) =>
      key ? rows[id]?.[key] : rows[id],
    sections: (_p: string, type: string) =>
      Object.values(rows).filter((row) => row['.type'] === type),
    save: write,
    set: write,
    add: write,
  };
  const section = { map: { lookupOption: () => [] } };
  const groups = new Map();
  const childIds = (owner: string, type: string, key = 'section') =>
    Object.values(rows)
      .filter((row) => row['.type'] === type && row[key] === owner)
      .map((row) => row['.name']);
  const get = new Function(
    'uci',
    'document',
    'UCI_PACKAGE',
    'sectionGroupSourceOptions',
    'outboundNameSourceOptions',
    'currentSectionGroupValues',
    'getChildItemIds',
    'urlTestSettingsKeys',
    'priorityGroupSettingsKeys',
    'priorityLevelSettingsKeys',
    block![0] +
      '\n; return {captureExtendedPreviewDraft,rememberExtendedPreviewContext,extendedPreviewModalStack};',
  );
  const api = get(
    uci,
    document,
    'forkop',
    groups,
    new Map(),
    (id: string, type: string) => childIds(id, type),
    childIds,
    () => ['name', 'include_outbounds', 'testing_url'],
    () => ['name', 'health_url', 'interrupt_exist_connections'],
    () => ['name', 'server_name', 'order'],
  );
  api.rememberExtendedPreviewContext(section);
  const original = JSON.stringify(rows);
  api.extendedPreviewModalStack.push({
    sectionId: 'main',
    ownerId: 'p1',
    itemId: 'l1',
    typeName: 'priority_level',
    keys: ['server_name', 'order'],
    map: {
      lookupOption: (key: string) => [
        { formvalue: () => (key === 'server_name' ? [] : '2') },
      ],
    },
  });
  const result = api.captureExtendedPreviewDraft('main');
  expect(result.unavailableReason).toBeUndefined();
  expect(result.draft.priority_level[0].server_name).toEqual([]);
  expect(result.draft.priority_level[0].order).toBe('2');
  expect(result.draft.priority_level[0].group).toBe('p1');
  expect(JSON.stringify(result)).not.toContain('SECRET');
  expect(JSON.stringify(rows)).toBe(original);
  expect(write).not.toHaveBeenCalled();
  rows.main.selector_proxy_links = ['vless://SECRET@host'];
  expect(api.captureExtendedPreviewDraft('main').unavailableReason).toBe(
    'source_draft_changed',
  );
});
