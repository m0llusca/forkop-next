// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('establishes saved source evidence after native Map loads UCI, before first capture', () => {
  const source = readFileSync(
    '../luci-app-forkop/htdocs/luci-static/resources/view/forkop/section.js',
    'utf8',
  );
  const block = source.match(
    /\/\/ Extended preview native snapshot begin[\s\S]*?\/\/ Extended preview native snapshot end/,
  )![0];
  let loaded = false;
  const row = {
    '.name': 'main',
    '.type': 'section',
    action: 'connection',
    selector_proxy_links: ['socks5://demo.example:1080#Main'],
  };
  const uci = {
    get: (_p: string, id: string) => (loaded && id === 'main' ? row : null),
    sections: (_p: string, type: string) =>
      loaded && type === 'section' ? [row] : [],
  };
  const api = new Function(
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
    block +
      '\nreturn {rememberExtendedPreviewContext,captureExtendedPreviewDraft};',
  )(
    uci,
    document,
    'forkop',
    new Map(),
    new Map(),
    () => [],
    () => [],
    () => [],
    () => [],
    () => [],
  );
  // Actual forkop.js constructs options first. LuCI Map.render then load()s UCI.
  const sectionRef = { map: { lookupOption: () => [] }, load: () => undefined };
  api.rememberExtendedPreviewContext(sectionRef);
  const loadSource = source.match(
    /sectionRef\.load = function \(\) \{[\s\S]*?\n {2}\};/,
  )![0];
  new Function(
    'sectionRef',
    'loadSectionTableOptions',
    'rememberExtendedPreviewContext',
    loadSource,
  )(sectionRef, () => undefined, api.rememberExtendedPreviewContext);
  loaded = true;
  sectionRef.load();
  expect(
    api.captureExtendedPreviewDraft('main').unavailableReason,
  ).toBeUndefined();
  row.selector_proxy_links = ['socks5://changed.example:1080#Changed'];
  sectionRef.load(); // Loading again must not bless dirty native source values.
  expect(api.captureExtendedPreviewDraft('main').unavailableReason).toBe(
    'source_draft_changed',
  );
});

it('does not classify an untouched inactive cascade selector as a source edit', async () => {
  const source = readFileSync(
    '../luci-app-forkop/htdocs/luci-static/resources/view/forkop/section.js',
    'utf8',
  );
  const rows = [
    {
      '.name': 'main',
      '.type': 'section',
      action: 'connection',
      selector_proxy_links: ['socks5://demo.example:1080#Main'],
    },
    { '.name': 'games', '.type': 'section', action: 'connection' },
  ];
  const uci = {
    get: (_package: string, id: string, key?: string) => {
      const row = rows.find((item) => item['.name'] === id);
      return key ? (row as Record<string, unknown>)?.[key] : row;
    },
    sections: (_package: string, type: string) =>
      rows.filter((row) => row['.type'] === type),
  };
  const helpers = source.slice(
    source.indexOf('function getUciSectionName('),
    source.indexOf('function isDnsDetourTargetSection('),
  );
  const refresh = new Function(
    'uci',
    'UCI_PACKAGE',
    helpers + '\nreturn refreshOutboundDetourSectionOptionValues;',
  )(uci, 'forkop');
  const optionSource = source.slice(
    source.indexOf(
      'o.load = function (section_id) {\n    refreshOutboundDetourSectionOptionValues',
    ),
    source.indexOf(
      'o.validate = function (section_id, value) {\n    if (!value)',
    ),
  );
  const option: {
    keylist: string[];
    vallist: string[];
    value: (key: string, label: string) => void;
    load?: (id: string) => Promise<string>;
  } = {
    keylist: [],
    vallist: [],
    value(key, label) {
      this.keylist.push(key);
      this.vallist.push(label);
    },
  };
  new Function(
    'o',
    'uci',
    'UCI_PACKAGE',
    'refreshOutboundDetourSectionOptionValues',
    optionSource,
  )(option, uci, 'forkop', refresh);
  const loaded = await option.load!('main');
  expect(loaded).toBe('');
  // Native form.ListValue/UISelect renders a nonoptional select. HTML selects
  // its first option when the empty loaded value has no matching choice.
  const select = document.createElement('select');
  for (const value of option.keylist) {
    const entry = document.createElement('option');
    entry.value = value;
    entry.selected = value === loaded;
    select.append(entry);
  }
  expect(select.value).toBe('games');
  const block = source.match(
    /\/\/ Extended preview native snapshot begin[\s\S]*?\/\/ Extended preview native snapshot end/,
  )![0];
  const api = new Function(
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
    block +
      '\nreturn {rememberExtendedPreviewContext,captureExtendedPreviewDraft};',
  )(
    uci,
    document,
    'forkop',
    new Map(),
    new Map(),
    () => [],
    () => [],
    () => [],
    () => [],
    () => [],
  );
  const enabled = document.createElement('input');
  enabled.type = 'checkbox';
  const options: Record<string, { formvalue: () => string }> = {
    outbound_detour_section: { formvalue: () => select.value },
    outbound_detour_enabled: { formvalue: () => (enabled.checked ? '1' : '0') },
  };
  api.rememberExtendedPreviewContext({
    map: {
      lookupOption: (key: string) => (options[key] ? [options[key]] : []),
    },
  });
  expect(
    api.captureExtendedPreviewDraft('main').unavailableReason,
  ).toBeUndefined();
  const other = document.createElement('option');
  other.value = 'another';
  select.append(other);
  select.value = 'another';
  expect(
    api.captureExtendedPreviewDraft('main').unavailableReason,
  ).toBeUndefined();
  enabled.checked = true;
  expect(api.captureExtendedPreviewDraft('main').unavailableReason).toBe(
    'cascade_draft_changed',
  );
  enabled.checked = false;
  rows[0].selector_proxy_links = ['socks5://changed.example:1080#Changed'];
  expect(api.captureExtendedPreviewDraft('main').unavailableReason).toBe(
    'source_draft_changed',
  );
  const saved = rows[0] as Record<string, unknown>;
  saved.outbound_detour_enabled = '1';
  saved.outbound_detour_section = 'games';
  enabled.checked = true;
  select.value = 'games';
  const enabledApi = new Function(
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
    block +
      '\nreturn {rememberExtendedPreviewContext,captureExtendedPreviewDraft};',
  )(
    uci,
    document,
    'forkop',
    new Map(),
    new Map(),
    () => [],
    () => [],
    () => [],
    () => [],
    () => [],
  );
  enabledApi.rememberExtendedPreviewContext({
    map: {
      lookupOption: (key: string) => (options[key] ? [options[key]] : []),
    },
  });
  expect(
    enabledApi.captureExtendedPreviewDraft('main').unavailableReason,
  ).toBeUndefined();
  select.value = 'another';
  expect(enabledApi.captureExtendedPreviewDraft('main').unavailableReason).toBe(
    'cascade_draft_changed',
  );
});
