// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import * as workflows from '../workflows';
import { renderAdvancedPanel } from '../advanced';
import { renderDeviceProfileTools } from '../tools';
const tick = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
afterEach(() => document.body.replaceChildren());
it('adds a URL hostname to the existing native condition draft without changing special formats', () => {
  const textarea = document.createElement('textarea');
  textarea.value = 'regex:^old\\.example/path$\nfull:old.example\nkeyword:keep';
  const wrapper = document.createElement('div');
  wrapper.append(textarea);
  document.body.append(wrapper);
  const changes: Event[] = [];
  textarea.addEventListener('input', (e) => changes.push(e));
  const quick = workflows.renderQuickSite(textarea, 'Рабочий VPN', 3);
  wrapper.prepend(quick);
  const input = quick.querySelector('input')!;
  input.value = 'https://Shop.Example.org/path?q=secret#frag';
  input.dispatchEvent(new Event('input'));
  expect(quick.textContent).toContain('shop.example.org');
  expect(quick.textContent).toContain('поддомены');
  expect(quick.textContent).toContain('Рабочий VPN');
  expect(quick.textContent).toContain('3');
  expect(quick.textContent).not.toContain('q=secret');
  quick.querySelector('button')!.click();
  expect(textarea.value).toBe(
    'regex:^old\\.example/path$\nfull:old.example\nkeyword:keep\nshop.example.org',
  );
  expect(changes).toHaveLength(1);
  quick.querySelector('button')!.click();
  expect(textarea.value.split('shop.example.org')).toHaveLength(2);
});
it.each(['regex:^a\\.b/.*$', 'keyword:a/b', 'full:a.example'])(
  'keeps special %s intact instead of URL-normalizing it',
  (value) => {
    const textarea = document.createElement('textarea');
    const quick = workflows.renderQuickSite(textarea, 'Rule', 1);
    document.body.append(quick);
    quick.querySelector('input')!.value = value;
    quick.querySelector('input')!.dispatchEvent(new Event('input'));
    quick.querySelector('button')!.click();
    expect(textarea.value).toBe(value);
  },
);
it('previews exact scope and explains an invalid fragment without changing the native draft', () => {
  const textarea = document.createElement('textarea');
  textarea.value = 'keep.example';
  const quick = workflows.renderQuickSite(textarea, 'Rule', 1);
  document.body.append(quick);
  const input = quick.querySelector('input')!;
  input.value = 'example.org/path?q=a';
  quick.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked =
    false;
  input.dispatchEvent(new Event('input'));
  quick.querySelector('button')!.click();
  expect(textarea.value).toBe('keep.example\nfull:example.org');
  input.value = 'bad host';
  input.dispatchEvent(new Event('input'));
  quick.querySelector('button')!.click();
  expect(textarea.value).toBe('keep.example\nfull:example.org');
  expect(quick.textContent).toMatch(/Сайт.*bad host.*домен/);
});
it('offers DHCP name and IPv4 hints in both pickers while retaining manual input and excluding IPv6', async () => {
  const map = document.createElement('div');
  map.className = 'cbi-map';
  document.body.append(map);
  map.addEventListener('forkop:workflow-context', (e) =>
    (e as CustomEvent).detail.provide({
      loadDevices: async () => ({
        '192.168.1.40': 'Console',
        '2001:db8::1': 'IPv6 host',
      }),
    }),
  );
  const root = renderDeviceProfileTools(async () => ({
    success: true,
    data: { items: [], sections: [] },
  }));
  map.append(root);
  for (const name of ['Адрес устройства', 'Игровое устройство']) {
    const input = root.querySelector<HTMLInputElement>(
      `[aria-label="${name}"]`,
    )!;
    input.dispatchEvent(new Event('focus'));
    await tick();
    const list = document.getElementById(input.getAttribute('list')!)!;
    expect(list.innerHTML).toContain('Console');
    expect(list.innerHTML).not.toContain('2001:db8');
    input.value = '192.168.1.99';
    expect(input.value).toBe('192.168.1.99');
  }
});
it('preserves target capabilities for each tool and gives a precise settings navigation for unavailable proxies', async () => {
  const map = document.createElement('div');
  map.className = 'cbi-map';
  document.body.append(map);
  map.addEventListener('forkop:workflow-context', (e) =>
    (e as CustomEvent).detail.provide({
      targets: [
        { name: 'ready', localProxyConfigured: true },
        { name: 'off', localProxyConfigured: false },
        { name: 'zap', localProxyConfigured: true },
      ],
    }),
  );
  const sections = [
    { name: 'ready', label: 'Ready', action: 'connection' },
    { name: 'off', label: 'Off', action: 'connection' },
    { name: 'dns', label: 'DNS', action: 'dns' },
    { name: 'zap', label: 'Zapret', action: 'zapret' },
    { name: 'unknown', label: 'Unknown', action: 'connection' },
  ];
  const root = renderAdvancedPanel(async (action) => ({
    success: true,
    data: action === 'status' ? { sections } : { items: [] },
  }));
  map.append(root);
  await tick();
  const panels = [...root.querySelectorAll('section')];
  const smart = panels.find(
    (p) => p.querySelector('h3')?.textContent === 'Smart Detect',
  )!;
  const choices = smart.querySelector('select')!;
  expect(
    choices.querySelector<HTMLOptionElement>('[value="ready"]')!.disabled,
  ).toBe(false);
  for (const name of ['off', 'dns', 'zap', 'unknown'])
    expect(
      choices.querySelector<HTMLOptionElement>(`[value="${name}"]`)!.disabled,
    ).toBe(true);
  const probe = [...root.querySelectorAll('label')]
    .find((l) => l.textContent?.startsWith('Маршрут проверки'))!
    .querySelector('select')!;
  expect(
    probe.querySelector<HTMLOptionElement>('[value="zap"]')!.disabled,
  ).toBe(false);
  expect(
    probe.querySelector<HTMLOptionElement>('[value="unknown"]')!.disabled,
  ).toBe(true);
  expect(smart.textContent).toContain('Настроить локальный прокси');
});
it('offers exact rule settings navigation beside unavailable diagnostic targets', async () => {
  const root = renderAdvancedPanel(
    async (action) => ({
      success: true,
      data:
        action === 'status'
          ? { sections: [{ name: 'off', label: 'Off', action: 'connection' }] }
          : { items: [] },
    }),
    undefined,
    false,
    'diagnostics',
  );
  document.body.append(root);
  await tick();
  expect(root.textContent).toContain('Настроить локальный прокси: Off');
});
it('does not change a read-only native condition field', () => {
  const textarea = document.createElement('textarea');
  textarea.value = 'keep.example';
  textarea.disabled = true;
  const quick = workflows.renderQuickSite(textarea, 'Rule', 1);
  document.body.append(quick);
  quick.querySelector('input')!.value = 'new.example';
  quick.querySelector('button')!.click();
  expect(textarea.value).toBe('keep.example');
});
it('rejects generated targets for new route rules while preserving the broader device assignment contract', async () => {
  const request = async (action: string) => ({
    success: true,
    data:
      action === 'status'
        ? {
            sections: [
              { name: 'generated', label: 'Temporary', action: 'connection' },
              { name: 'native', label: 'Native', action: 'connection' },
            ],
          }
        : { items: [] },
  });
  const root = renderAdvancedPanel(request);
  document.body.append(root);
  root.addEventListener('forkop:workflow-context', (event) =>
    (event as CustomEvent).detail.provide({
      targets: [
        { name: 'generated', localProxyConfigured: true, generated: true },
        { name: 'native', localProxyConfigured: true, generated: false },
      ],
    }),
  );
  await tick();
  const gaming = root.querySelector<HTMLSelectElement>(
    '[aria-label="Игровой маршрут"]',
  )!;
  expect(
    gaming.querySelector<HTMLOptionElement>('[value="generated"]'),
  ).toBeNull();
  expect(
    gaming.querySelector<HTMLOptionElement>('[value="native"]')!.disabled,
  ).toBe(false);
  const temporary = [...root.querySelectorAll('section')]
    .find((p) => p.querySelector('h3')?.textContent === 'Временные правила')!
    .querySelector('select')!;
  expect(
    temporary.querySelector<HTMLOptionElement>('[value="generated"]'),
  ).toBeNull();
  expect(
    root.querySelector<HTMLOptionElement>(
      '[aria-label="Маршрут устройства"] option[value="generated"]',
    )!.disabled,
  ).toBe(false);
});
it.each(['user:private@example.org', 'bad host?token=private'])(
  'omits credentials and query fragments from invalid URL preview (%s)',
  (value) => {
    const quick = workflows.renderQuickSite(
      document.createElement('textarea'),
      'Rule',
      1,
    );
    document.body.append(quick);
    quick.querySelector('input')!.value = value;
    quick.querySelector('input')!.dispatchEvent(new Event('input'));
    expect(quick.textContent).not.toContain('private');
    expect(quick.textContent).toContain('Сайт:');
  },
);

it.each([
  ['zapret', true, 'action'],
  ['zapret2', true, 'action'],
  ['byedpi', true, 'action'],
  ['connection', false, 'mixed_proxy_enabled'],
  ['vpn', undefined, 'mixed_proxy_enabled'],
] as const)(
  'opens the setting that resolves Smart Detect eligibility for %s (proxy %s)',
  async (action, localProxyConfigured, option) => {
    const map = document.createElement('div');
    map.className = 'cbi-map';
    map.innerHTML =
      '<div class="cbi-tabmenu"><div data-tab="section"><a>Rules</a></div></div><div class="cbi-map-tabbed"><div data-tab="section"></div></div>';
    document.body.append(map);
    map.addEventListener('forkop:workflow-context', (event) =>
      (event as CustomEvent).detail.provide({
        targets: [{ name: 'target', localProxyConfigured }],
      }),
    );
    const navigations: unknown[] = [];
    map
      .querySelector('.cbi-map-tabbed > div')!
      .addEventListener('forkop:navigate-rule', (event) => {
        navigations.push((event as CustomEvent).detail);
        event.preventDefault();
      });
    const requests: string[] = [];
    const root = renderAdvancedPanel(
      async (method) => {
        requests.push(method);
        return {
          success: true,
          data:
            method === 'status'
              ? { sections: [{ name: 'target', label: 'Target', action }] }
              : { items: [] },
        };
      },
      undefined,
      false,
      'rules',
    );
    map.append(root);
    await tick();
    const smart = [...root.querySelectorAll('section')].find(
      (panel) => panel.querySelector('h3')?.textContent === 'Smart Detect',
    )!;
    const before = [...requests];
    [...smart.querySelectorAll('button')]
      .find((button) => button.textContent?.endsWith(': Target'))!
      .click();
    expect(navigations).toEqual([{ kind: 'edit', section: 'target', option }]);
    expect(requests).toEqual(before);
  },
);

it('offers only supported temporary targets without starting a write or probe', async () => {
  const requests: string[] = [];
  const root = renderAdvancedPanel(
    async (method) => {
      requests.push(method);
      return {
        success: true,
        data:
          method === 'status'
            ? {
                sections: [
                  { name: 'dns', action: 'dns' },
                  { name: 'zap', action: 'zapret' },
                  { name: 'unknown' },
                  { name: 'vpn', action: 'connection' },
                  { name: 'direct', action: 'bypass' },
                  { name: 'block', action: 'block' },
                ],
              }
            : { items: [] },
      };
    },
    undefined,
    false,
    'rules',
  );
  document.body.append(root);
  await tick();
  const select = [...root.querySelectorAll('section')]
    .find(
      (panel) => panel.querySelector('h3')?.textContent === 'Временные правила',
    )!
    .querySelector('select')!;
  expect([...select.options].map((option) => option.value)).toEqual([
    '',
    'vpn',
    'direct',
    'block',
  ]);
  const before = [...requests];
  select.value = 'vpn';
  select.dispatchEvent(new Event('change'));
  expect(requests).toEqual(before);
});
