// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import * as publicHelpers from '../../../main';
import { nativeRuleTableMethods } from './fixtures/nativeRuleTableMethods.js';

type Rule = Record<string, unknown>;
type Option = {
  option: string;
  title: string;
  modalonly?: boolean;
  keylist: string[];
  vallist: string[];
  cfgvalue: (id: string) => unknown;
  textvalue?: (id: string) => unknown;
  load?: (id: string) => Promise<unknown>;
  renderWidget: (id: string, index: number, value: string) => HTMLElement;
  validate: (id: string, value: string) => boolean;
  write: (id: string, value: string) => void;
};

afterEach(() => document.body.replaceChildren());

function fixture(rule: Rule, neighbours = false) {
  const entries: Record<string, Rule> = {
    ...(neighbours
      ? { first: { '.name': 'first', '.index': 0, label: 'Первое' } }
      : {}),
    example: { '.name': 'example', '.index': neighbours ? 1 : 0, ...rule },
    ...(neighbours
      ? { last: { '.name': 'last', '.index': 2, label: 'Последнее' } }
      : {}),
  };
  const reorder: Record<string, boolean> = {};
  // Execute the captured native UCI move body against real ordered records.
  const uciSource = readFileSync(
    'src/forkop/workspace/tests/fixtures/nativeUciMove.js',
    'utf8',
  );
  const move = new Function(
    `const native = ${uciSource}; return native.move;`,
  )();
  const data = {
    state: { reorder },
    sections: () =>
      Object.values(entries).sort(
        (a, b) => Number(a['.index']) - Number(b['.index']),
      ),
    get: (_config: string, id: string) => entries[id],
    resolveSID: (_config: string, id: string) => id,
    move,
  };
  const original = JSON.stringify(entries);
  Object.defineProperty(String.prototype, 'format', {
    configurable: true,
    value: function (this: string, ...values: unknown[]) {
      let index = 0;
      return this.replace(/%[sd]/g, () => String(values[index++]));
    },
  });
  function E(tag: string | unknown[], attrs?: unknown, children?: unknown) {
    const element = Array.isArray(tag)
      ? document.createDocumentFragment()
      : document.createElement(tag);
    if (
      attrs &&
      typeof attrs === 'object' &&
      !Array.isArray(attrs) &&
      !(attrs instanceof Node)
    ) {
      for (const [key, value] of Object.entries(attrs)) {
        if (typeof value === 'function')
          element.addEventListener(key, value as EventListener);
        else if (value != null && element instanceof Element)
          element.setAttribute(key, String(value));
      }
    } else if (children === undefined) children = attrs;
    for (const child of Array.isArray(tag)
      ? tag
      : Array.isArray(children)
        ? children
        : [children]) {
      if (child instanceof Node) element.append(child);
      else if (child != null) element.append(String(child));
    }
    return element;
  }
  const native = nativeRuleTableMethods(
    E,
    {
      elem: (value: unknown) => value instanceof Node,
      parse: (markup: string) => {
        const template = document.createElement('template');
        template.innerHTML = markup;
        return template.content.firstChild;
      },
      bindClassInstance() {},
    },
    {
      bind: (fn: (...args: unknown[]) => unknown, context: unknown) =>
        fn.bind(context),
    },
    (text: string) => text,
  );
  const nativeActions = document.createElement('td');
  nativeActions.className = 'td cbi-section-actions';
  const edit = document.createElement('button');
  edit.textContent = 'Native edit';
  nativeActions.append(edit);
  // This boundary records real native option registrations, without replacing
  // the section's field construction, choice loading or presentation logic.
  const nativeTextareas: Array<{
    node: HTMLElement;
    getValue: () => string;
    setValue: (value: string) => void;
  }> = [];
  class NativeOption {
    static extend(properties: object) {
      class Child extends this {}
      Object.assign(Child.prototype, properties);
      return Child;
    }
    keylist: string[] = [];
    vallist: string[] = [];
    constructor(
      public option: string,
      public title: string,
    ) {}
    value(key: string, label: string) {
      (this.keylist ||= []).push(key);
      (this.vallist ||= []).push(label);
    }
    depends() {}
    cfgvalue() {}
    renderWidget(_id: string, _index: number, value: string) {
      const wrapper = document.createElement('div');
      const textarea = document.createElement('textarea');
      textarea.value = value;
      wrapper.append(textarea);
      // LuCI ui.Textarea reads/writes its first element, not querySelector().
      // Capture the original native root before Forkop decorates the widget.
      nativeTextareas.push({
        node: wrapper,
        getValue() {
          return (this.node.firstElementChild as HTMLTextAreaElement).value;
        },
        setValue(value) {
          (this.node.firstElementChild as HTMLTextAreaElement).value = value;
        },
      });
      return wrapper;
    }
  }
  const form = Object.fromEntries(
    [
      'Value',
      'Flag',
      'ListValue',
      'DummyValue',
      'DynamicList',
      'TextValue',
    ].map((name) => [name, NativeOption]),
  );
  const section = {
    ...native,
    anonymous: false,
    sectiontype: 'section',
    map: { config: 'forkop', data },
    children: [] as Option[],
    sectiontitle: (id: string): unknown => entries[id].label || id,
    tab() {},
    taboption(
      _tab: string,
      Type: typeof NativeOption,
      key: string,
      title: string,
    ) {
      const option = new Type(key, title) as unknown as Option;
      this.children.push(option);
      return option;
    },
    handleRemove() {},
    renderHeaderRows: () => document.createDocumentFragment(),
    renderFooterRows: () => document.createDocumentFragment(),
    renderSectionAdd: () => document.createDocumentFragment(),
    renderRowActions: (id: string) =>
      id === 'example' ? nativeActions : nativeActions.cloneNode(true),
    stabilizeActionColumnWidth() {},
  };
  const source = readFileSync(
    '../luci-app-forkop/htdocs/luci-static/resources/view/forkop/section.js',
    'utf8',
  );
  const module = new Function(
    'baseclass',
    'form',
    'ui',
    'uci',
    'main',
    'localDevices',
    '_',
    'E',
    source,
  )(
    { extend: (value: unknown) => value },
    form,
    { DynamicList: NativeOption },
    {
      get: (_config: string, id: string, key?: string) =>
        key ? entries[id]?.[key] : entries[id],
      sections: () => Object.values(entries),
      set: (_config: string, id: string, key: string, value: unknown) => {
        entries[id][key] = value;
      },
      unset: (_config: string, id: string, key: string) => {
        delete entries[id][key];
      },
    },
    { ...publicHelpers, DOMAIN_LIST_OPTIONS: {} },
    {},
    (text: string) => text,
    E,
  );
  module.configureSectionSection(section, {
    loadActionProvidersAvailability: async () => ({
      zapretInstalled: true,
      zapret2Installed: true,
      byedpiInstalled: true,
    }),
  });
  module.createSectionContent(section);
  const action = section.children.find((o) => o.option === 'action')!;
  const route = section.children.find((o) => o.option === '_action_display')!;
  const render = () => {
    const ids = data.sections().map((row) => String(row['.name']));
    return section.renderContents(
      ids,
      ids.map((id) => {
        const rowFields = document.createElement('div');
        const enabled = document.createElement('td');
        enabled.innerHTML = '<input type="checkbox">';
        rowFields.append(enabled, section.renderTextValue(id, route));
        return rowFields;
      }),
    );
  };
  return {
    section,
    action,
    route,
    render,
    entries,
    original,
    nativeActions,
    reorder,
    data,
    nativeTextareas,
  };
}

it('names rule toggles and persists above/below moves with the native UCI priority order while retaining drafts', () => {
  const state = fixture({ label: 'Работа' }, true);
  const table = state.render();
  document.body.append(table);
  const row = table.querySelector<HTMLElement>('[data-sid=example]')!;
  const body = row.parentElement!;
  const insertBefore = body.insertBefore.bind(body);
  // Real browsers lose descendant focus when insertBefore reinserts its row.
  // Preserve real DOM movement and simulate only that missing happy-dom effect.
  body.insertBefore = function <T extends Node>(
    moved: T,
    reference: Node | null,
  ): T {
    const focused = document.activeElement;
    const result = insertBefore(moved, reference);
    if (focused instanceof HTMLElement && moved.contains(focused))
      focused.blur();
    return result;
  };
  expect(row.querySelector('input')?.getAttribute('aria-label')).toBe(
    'Включить правило Работа',
  );
  const draft = document.createElement('input');
  draft.value = 'unsaved rule';
  row.append(draft);
  const up = row.querySelector<HTMLButtonElement>(
    '[aria-label="Выше: Работа"]',
  );
  const down = row.querySelector<HTMLButtonElement>(
    '[aria-label="Ниже: Работа"]',
  );
  expect(up).not.toBeNull();
  up!.focus();
  up!.click();
  expect(state.data.sections().map((s) => s['.name'])).toEqual([
    'example',
    'first',
    'last',
  ]);
  expect(
    [...table.querySelectorAll('tr[data-sid]')].map((r) =>
      r.getAttribute('data-sid'),
    ),
  ).toEqual(['example', 'first', 'last']);
  expect(state.reorder.forkop).toBe(true);
  expect(up!.disabled).toBe(true);
  expect(table.querySelector('[role=status]')?.textContent).toContain(
    'Работа: позиция 1 из 3',
  );
  expect(document.activeElement).toBe(down);
  down!.click();
  expect(state.data.sections().map((s) => s['.name'])).toEqual([
    'first',
    'example',
    'last',
  ]);
  expect(down!.disabled).toBe(false);
  expect(
    document.activeElement === down,
    'middle move restores its enabled button focus',
  ).toBe(true);
  expect(draft.value).toBe('unsaved rule');
  expect(row.contains(draft)).toBe(true);
});

it('announces a rejected native reorder without changing DOM order or draft state', () => {
  const state = fixture({ label: 'Работа' }, true);
  state.data.move = () => false;
  const table = state.render();
  document.body.append(table);
  const up = table.querySelector<HTMLButtonElement>(
    '[aria-label="Выше: Работа"]',
  );
  expect(up).not.toBeNull();
  up!.click();
  expect(
    [...table.querySelectorAll('tr[data-sid]')].map((r) =>
      r.getAttribute('data-sid'),
    ),
  ).toEqual(['first', 'example', 'last']);
  expect(table.querySelector('[role=status]')?.textContent).toContain(
    'Не удалось',
  );
  expect(state.reorder.forkop).toBeUndefined();
});

it('renders the rule name and scope through native table rendering without corrupting its textual title or row actions', () => {
  const { section, render, nativeActions } = fixture({
    label: 'Работа',
    domain: 'example.org',
  });
  const table = render();
  const row = table.querySelector<HTMLTableRowElement>('[data-sid="example"]')!;
  expect(row.dataset.title).toBe('Работа');
  expect(section.sectiontitle('example')).toBe('Работа');
  expect(
    row.querySelector('.cbi-section-table-titles .fkp-rule-name')?.textContent,
  ).toBe('Работа');
  expect(
    row.querySelector('.cbi-section-table-titles .fkp-rule-scope')?.textContent,
  ).toBe('Домены: 1');
  expect(row.children).toHaveLength(4);
  expect(row.querySelector('.cbi-section-actions')).toBe(nativeActions);
  expect(row.textContent).not.toContain('[object HTMLDivElement]');
});

it.each([
  ['connection', 'Через подключение'],
  ['bypass', 'Напрямую'],
  ['block', 'Блокировать'],
  ['dns', 'Свой DNS'],
  ['zapret', 'Zapret'],
  ['zapret2', 'Zapret2'],
  ['byedpi', 'ByeDPI'],
])(
  'shows the same readable %s action in the native grid and editor without rewriting its value',
  async (action, label) => {
    const state = fixture({ action });
    await state.action.load!('example');
    expect(state.render().querySelector('.fkp-rule-action')?.textContent).toBe(
      label,
    );
    expect(state.action.vallist[state.action.keylist.indexOf(action)]).toBe(
      label,
    );
    expect(JSON.stringify(state.entries)).toBe(state.original);
  },
);

it('summarizes mixed match conditions and device scopes without claiming a catch-all', () => {
  const state = fixture({
    label: 'Работа',
    domain: 'example.org\nfull:login.example.org # comment',
    domain_suffix: ['legacy.example'],
    domain_keyword_text: 'legacy-key',
    community_lists: ['youtube'],
    rule_set: ['https://secret.example/list?token=hidden'],
    domain_ip_lists: ['/private/path.lst'],
    ip_cidr: ['198.51.100.0/24'],
    ports: ['443', '1000-2000'],
    source_ip_cidr: ['192.0.2.1/32'],
    fully_routed_ips: ['192.0.2.2'],
  });
  const scope = state.render().querySelector('.fkp-rule-scope')?.textContent;
  expect(scope).toContain('Домены: 4');
  expect(scope).toContain('Списки: 3');
  expect(scope).toContain('IP назначения: 1');
  expect(scope).toContain('Порты: 2');
  expect(scope).toContain('Фильтр устройств: 1');
  expect(scope).toContain('Принудительно для устройств: 1');
  expect(state.render().textContent).not.toContain('hidden');
});

it('counts a subnet-enabled custom list as an active rule condition without exposing its reference', async () => {
  const reference = 'https://private.example/rules.srs?token=hidden';
  const state = fixture({ rule_set_with_subnets: [reference] });
  expect(state.render().querySelector('.fkp-rule-scope')?.textContent).toBe(
    'Списки: 1',
  );
  const editor = state.section.children.find((o) => o.option === 'rule_set')!;
  expect(await editor.load!('example')).toEqual([reference]);
  expect(state.render().textContent).not.toMatch(/private|hidden|rules\.srs/);
  expect(JSON.stringify(state.entries)).toBe(state.original);
});

it('counts the native union of ordinary and subnet-enabled custom lists without duplicates', () => {
  const state = fixture({
    community_lists: ['youtube'],
    rule_set: ['https://private.example/one.srs'],
    rule_set_with_subnets: [
      ' https://private.example/one.srs ',
      'https://private.example/two.srs',
    ],
    domain_ip_lists: ['/private/three.lst'],
  });
  expect(state.render().querySelector('.fkp-rule-scope')?.textContent).toBe(
    'Списки: 4',
  );
  expect(state.render().textContent).not.toContain('private');
});

it.each([
  [[], 'Условия не заданы'],
  [['https://private.example/domains.srs'], 'Списки: 1'],
])(
  'does not count invalid subnet-extraction storage as active DNS scope with ordinary lists %j',
  (ordinary, expected) => {
    const state = fixture({
      action: 'dns',
      rule_set: ordinary,
      rule_set_with_subnets: ['https://private.example/subnets.srs'],
    });
    expect(state.render().querySelector('.fkp-rule-scope')?.textContent).toBe(
      expected,
    );
    expect(JSON.stringify(state.entries)).toBe(state.original);
  },
);

it('counts each of the six connection sources without exposing links, credentials, JSON or private names', () => {
  const state = fixture({
    action: 'connection',
    selector_proxy_links: ['vless://credential@private.example:443'],
    subscription_url: ['subscription-private'],
    interfaces: ['private-interface'],
    outbound_jsons: ['{"password":"json-secret"}'],
    urltest: ['private-urltest'],
    priority_group: ['private-priority'],
  });
  const row = state.render();
  expect(row.querySelector('.fkp-rule-route')?.textContent).toBe(
    'Ссылки: 1 · Подписки: 1 · Интерфейсы: 1 · JSON: 1 · URLTest: 1 · Приоритет: 1',
  );
  expect(row.innerHTML).not.toMatch(
    /credential|private|json-secret|vless:|password/,
  );
});

it('counts configured list items as items, even when a group name contains spaces', () => {
  const row = fixture({
    urltest: ['Work group'],
    priority_group: ['Backup group'],
  }).render();
  expect(row.querySelector('.fkp-rule-route')?.textContent).toBe(
    'URLTest: 1 · Приоритет: 1',
  );
});

it('follows the native editor precedence for old text values without counting inactive duplicates', () => {
  const row = fixture({
    ip_cidr: ['198.51.100.0/24'],
    ip_cidr_text: '203.0.113.0/24',
    source_ip_cidr: ['192.0.2.1'],
    source_ip_cidr_text: '192.0.2.2',
    ports: ['443'],
    ports_text: '80',
  }).render();
  expect(row.querySelector('.fkp-rule-scope')?.textContent).toBe(
    'IP назначения: 1 · Порты: 1 · Фильтр устройств: 1',
  );
});

it('bounds large summaries and never echoes a malformed action containing private data', () => {
  const row = fixture({
    action: 'vless://credential@private.example',
    domain: Array.from({ length: 1200 }, (_, i) => `domain${i}.example`).join(
      '\n',
    ),
  }).render();
  expect(row.querySelector('.fkp-rule-scope')?.textContent).toBe(
    'Домены: 999+',
  );
  expect(row.querySelector('.fkp-rule-action')?.textContent).toBe(
    'Неизвестное действие',
  );
  expect(row.innerHTML).not.toMatch(/credential|private\.example|domain1199/);
});

it('recognizes legacy-only domain, address, port and device text while ignoring comments', () => {
  const row = fixture({
    domain_suffix_text: 'suffix.example\n# ignored',
    domain_text: 'exact.example',
    domain_keyword: ['keyword'],
    domain_regex_text: '^regex$',
    ip_cidr_text: '198.51.100.0/24',
    ports_text: '443',
    source_ip_cidr_text: '192.0.2.1 // ignored',
  }).render();
  expect(row.querySelector('.fkp-rule-scope')?.textContent).toBe(
    'Домены: 4 · IP назначения: 1 · Порты: 1 · Фильтр устройств: 1',
  );
});

it('describes DNS scope without suggesting that dormant IP or port fields route device traffic', () => {
  const row = fixture({
    action: 'dns',
    domain: 'example.org',
    ip_cidr: ['198.51.100.0/24'],
    ports: ['443'],
    fully_routed_ips: ['192.0.2.1'],
    selector_proxy_links: ['vless://secret@private.example:443'],
  }).render();
  expect(row.querySelector('.fkp-rule-scope')?.textContent).toBe(
    'Домены: 1 · DNS всех запросов устройств: 1',
  );
  expect(row.querySelector('.fkp-rule-route')?.textContent).toBe(
    'DNS по настройкам правила',
  );
  expect(row.textContent).not.toMatch(/Порты|IP назначения|secret|Ссылки/);
});

it.each([
  ['proxy', 'Через прокси (старое правило)'],
  ['vpn', 'Через VPN (старое правило)'],
  ['outbound', 'Через JSON (старое правило)'],
  ['future_action', 'Неизвестное действие: future_action'],
])(
  'preserves and distinguishes configured legacy or unknown action %s in the editor',
  async (action, label) => {
    const state = fixture({ action });
    await state.action.load!('example');
    expect(state.render().querySelector('.fkp-rule-action')?.textContent).toBe(
      label,
    );
    expect(state.action.vallist[state.action.keylist.indexOf(action)]).toBe(
      label,
    );
    expect(state.action.cfgvalue('example')).toBe(action);
    expect(JSON.stringify(state.entries)).toBe(state.original);
  },
);

it('marks a disabled empty rule without suggesting that it matches every request', () => {
  const row = fixture({
    enabled: '0',
    label: '<script>name</script>',
  }).render();
  expect(row.querySelector('.fkp-rule-state')?.textContent).toBe('Выключено');
  expect(row.querySelector('.fkp-rule-scope')?.textContent).toBe(
    'Условия не заданы',
  );
  expect(row.querySelector('.fkp-rule-route')?.textContent).toBe(
    'Источники не заданы',
  );
  expect(row.querySelector('script')).toBeNull();
});

it('retains every native modal field and keeps only enable and route as ordinary grid options', () => {
  const { section } = fixture({});
  const required = [
    'label',
    'action',
    'selector_proxy_links',
    'subscription_url',
    'interfaces',
    'outbound_jsons',
    'urltest',
    'priority_group',
    'domain',
    'ip_cidr',
    'community_lists',
    'rule_set',
    'domain_ip_lists',
    'source_ip_cidr',
    'fully_routed_ips',
    'ports',
    'dns_type',
    'dns_server',
    'outbound_detour_enabled',
    'mixed_proxy_password',
  ];
  for (const key of required) {
    expect(section.children.find((o) => o.option === key)?.modalonly).toBe(
      true,
    );
  }
  expect(
    section.children.filter((o) => !o.modalonly).map((o) => o.option),
  ).toEqual(['enabled', '_action_display']);
});

it('uses the actual native domain widget and write cleanup for a quick URL addition without copying sources', () => {
  const { section, entries } = fixture({
    label: 'VPN',
    subscription_url: ['child_subscription'],
    domain: 'regex:^old\\.example/path$\nfull:keep.example',
    domain_suffix: ['legacy.example'],
  });
  const option = section.children.find((o) => o.option === 'domain')!;
  const widget = option.renderWidget(
    'example',
    0,
    String(entries.example.domain),
  );
  document.body.append(widget);
  const input = widget.querySelector<HTMLInputElement>(
    '[aria-label="Сайт или адрес страницы"]',
  )!;
  input.value = 'https://shop.example.org/path?token=secret';
  input.dispatchEvent(new Event('input'));
  widget.querySelector('button')!.click();
  const textarea = widget.querySelector('textarea')!;
  expect(textarea.value).toBe(
    'regex:^old\\.example/path$\nfull:keep.example\nshop.example.org',
  );
  expect(option.validate('example', textarea.value)).toBe(true);
  option.write('example', textarea.value);
  expect(entries.example.domain).toBe(textarea.value);
  expect(entries.example.subscription_url).toEqual(['child_subscription']);
  expect(Object.keys(entries)).toEqual(['example']);
  expect(entries.example.domain_suffix).toBeUndefined();
});

it('preserves all saved domains through the native textarea getter and save/reopen without an edit', () => {
  const originalDomains = Array.from(
    { length: 120 },
    (_, index) => `site${index}.example`,
  ).join('\n');
  const { section, entries, nativeTextareas } = fixture({
    domain: originalDomains,
  });
  const option = section.children.find((o) => o.option === 'domain')!;
  document.body.append(option.renderWidget('example', 0, originalDomains));
  const native = nativeTextareas[nativeTextareas.length - 1];
  expect(native.node.firstElementChild?.tagName).toBe('TEXTAREA');
  expect(native.getValue()).toBe(originalDomains);
  option.write('example', native.getValue());
  expect(entries.example.domain).toBe(originalDomains);
  expect(option.load!('example')).toBe(originalDomains);
});

it('persists a quick-added site through native save and reopening while preserving the 120 prior domains', () => {
  const originalDomains = Array.from(
    { length: 120 },
    (_, index) => `site${index}.example`,
  ).join('\n');
  const { section, entries, nativeTextareas } = fixture({
    domain: originalDomains,
  });
  const option = section.children.find((o) => o.option === 'domain')!;
  const rendered = option.renderWidget('example', 0, originalDomains);
  document.body.append(rendered);
  rendered.querySelector<HTMLInputElement>(
    '[aria-label="Сайт или адрес страницы"]',
  )!.value = 'added.example';
  rendered.querySelector('button')!.click();
  const native = nativeTextareas[nativeTextareas.length - 1];
  const expected = `${originalDomains}\nadded.example`;
  expect(native.getValue()).toBe(expected);
  option.write('example', native.getValue());
  expect(entries.example.domain).toBe(expected);
  expect(option.load!('example')).toBe(expected);
  const reopened = option.renderWidget(
    'example',
    0,
    String(option.load!('example')),
  );
  document.body.replaceChildren(reopened);
  const reopenedNative = nativeTextareas[nativeTextareas.length - 1];
  expect(reopenedNative.getValue()).toBe(expected);
  reopenedNative.setValue(originalDomains);
  option.write('example', reopenedNative.getValue());
  expect(entries.example.domain).toBe(originalDomains);
});
