// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { renderAdvancedPanel, type Request } from '../advanced';
const tick = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
afterEach(() => document.body.replaceChildren());
const button = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent === text)!;
const field = (name: string) =>
  document.querySelector<HTMLInputElement>(`[name=${name}]`)!;
function setup(response: Record<string, unknown> = {}) {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const request: Request = async (action, payload = {}) => {
    calls.push([action, payload]);
    if (action === 'status')
      return {
        success: true,
        data: {
          digest: 'active',
          sections: [{ name: 'native_7', label: 'VPN', action: 'connection' }],
        },
      };
    if (action === 'profile_list')
      return { success: true, data: { items: [{ name: 'Travel' }] } };
    return { success: true, data: response };
  };
  document.body.append(renderAdvancedPanel(request));
  return calls;
}
it.each([
  ['udp', '443'],
  ['tcp', '8443'],
])(
  'explains %s/%s with captured saved basis and exact rule navigation',
  async (protocol, port) => {
    const calls = setup({
      scope: 'configured',
      decision: { status: 'matched', section: 'native_7' },
      trace: [
        { section: 'native_7', match: 'yes', reason: 'section_conditions' },
      ],
    });
    await tick();
    field('domain').value = 'example.org';
    field('device').value = '192.168.1.8';
    expect(field('route_protocol')).not.toBeNull();
    expect(field('route_port')).not.toBeNull();
    field('route_protocol').value = protocol;
    field('route_port').value = port;
    button('Объяснить маршрут').click();
    await tick();
    expect(calls).toContainEqual([
      'route_explain',
      {
        domain: 'example.org',
        device: '192.168.1.8',
        protocol,
        port: Number(port),
      },
    ]);
    expect(document.body.textContent).toContain('Сохранённая конфигурация');
    expect(document.body.textContent).toContain(
      `${protocol.toUpperCase()}/${port}`,
    );
    expect(document.body.textContent).toContain('Условия правила');
    expect(button('Открыть правило')).toBeDefined();
    const map = document.createElement('div');
    map.className = 'cbi-map';
    const tabs = document.createElement('div');
    tabs.className = 'cbi-tabmenu';
    const tab = document.createElement('div');
    tab.dataset.tab = 'section';
    tab.append(document.createElement('a'));
    tabs.append(tab);
    const panes = document.createElement('div');
    panes.className = 'cbi-map-tabbed';
    const pane = document.createElement('section');
    pane.dataset.tab = 'section';
    panes.append(pane);
    const destinations: unknown[] = [];
    pane.addEventListener('forkop:navigate-rule', (event) => {
      destinations.push((event as CustomEvent).detail);
      event.preventDefault();
    });
    const panel = document.querySelector<HTMLElement>('.fkp-next')!;
    map.append(tabs, panes, panel);
    document.body.append(map);
    button('Открыть правило').click();
    await tick();
    expect(destinations).toEqual([
      { kind: 'edit', section: 'native_7', option: 'domain' },
    ]);
    expect(calls.some(([a]) => a === 'probe')).toBe(false);
  },
);
it('does not present an unknown condition as a winning rule and invalidates a port-edited result', async () => {
  setup({
    decision: { status: 'indeterminate', section: 'native_7' },
    trace: [
      { section: 'native_7', match: 'unknown', reason: 'section_conditions' },
    ],
    missing: ['rule_set'],
  });
  await tick();
  field('domain').value = 'example.org';
  button('Объяснить маршрут').click();
  await tick();
  expect(document.body.textContent).toContain('Не подтверждено');
  expect(document.body.textContent).toContain('содержимое набора правил');
  expect(button('Открыть правило')).toBeUndefined();
  field('route_port').value = '8443';
  field('route_port').dispatchEvent(new Event('input'));
  expect(document.querySelector('.fkp-next-result')!.textContent).toContain(
    'Параметры изменены',
  );
});
it('sends a destination IP without a blank optional device and rejects malformed port without a request', async () => {
  const calls = setup({ decision: { status: 'direct' } });
  await tick();
  field('domain').value = '203.0.113.8';
  field('route_port').value = '8443x';
  button('Объяснить маршрут').click();
  await tick();
  expect(calls.some(([action]) => action === 'route_explain')).toBe(false);
  field('route_port').value = '8443';
  button('Объяснить маршрут').click();
  await tick();
  expect(calls).toContainEqual([
    'route_explain',
    { destination_ip: '203.0.113.8', protocol: 'tcp', port: 8443 },
  ]);
});
it('summarizes semantic impact without raw values or arbitrary response fields and keeps both reviewed digests', async () => {
  const calls = setup({
    changed: [
      'main.domain',
      'main.fully_routed_ips',
      'settings.dns_server',
      'main.password',
    ],
    current_digest: 'reviewed-current',
    profile_digest: 'reviewed-profile',
    config: 'never-render-this-secret',
  });
  await tick();
  button('Сравнить профиль').click();
  await tick();
  expect(document.body.textContent).toContain('Правила и подключения: 1');
  expect(document.body.textContent).toContain('Устройства: 1');
  expect(document.body.textContent).toContain('DNS: 1');
  expect(document.body.textContent).toContain('Прочие параметры: 1');
  expect(document.body.textContent).not.toContain('never-render-this-secret');
  button('Применить профиль').click();
  await tick();
  expect(calls).toContainEqual([
    'profile_apply',
    {
      name: 'Travel',
      expected: 'reviewed-current',
      expected_profile: 'reviewed-profile',
    },
  ]);
});
it('offers five symptom entries without running a check while entering or changing scenario', async () => {
  const calls = setup();
  await tick();
  const scenarios = document.querySelector<HTMLSelectElement>(
    '[name=diagnostic_symptom]',
  );
  expect(scenarios).not.toBeNull();
  expect([...scenarios!.options].map((o) => o.textContent)).toEqual([
    'Не работает всё',
    'Один сайт',
    'Одно устройство',
    'Не обновляется подписка',
    'Не запускается служба',
  ]);
  scenarios!.value = 'source';
  scenarios!.dispatchEvent(new Event('change'));
  expect(
    calls.some(([a]) =>
      [
        'diagnostic_dns',
        'diagnostic_service',
        'probe',
        'source_evidence',
      ].includes(a),
    ),
  ).toBe(false);
});
