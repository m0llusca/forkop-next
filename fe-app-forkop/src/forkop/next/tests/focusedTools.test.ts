// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { renderAdvancedPanel, type Request } from '../advanced';
import { renderDeviceProfileTools } from '../tools';

const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(() => document.body.replaceChildren());
function reader() {
  const calls: string[] = [];
  const request: Request = async (action) => {
    calls.push(action);
    return {
      success: true,
      data:
        action === 'status'
          ? { sections: [{ name: 'vpn', label: 'Домашний VPN' }], versions: {} }
          : {
              items:
                action === 'devices'
                  ? [{ address: '192.168.1.7', section: 'vpn' }]
                  : [],
            },
    };
  };
  return { calls, request };
}
it.each([
  [
    'rules',
    ['status', 'temporary_list', 'recommendations'],
    ['Временные правила', 'Smart Detect'],
  ],
  ['diagnostics', ['status'], ['Почему сайт идёт так?']],
  ['devices', ['status', 'devices'], ['Устройства', 'Игровые пресеты']],
  [
    'settings',
    ['status', 'profile_list'],
    ['Профили и восстановление', 'Импорт и экспорт профилей'],
  ],
] as const)(
  'mounts only %s tools and performs only their startup reads',
  async (area, reads, headings) => {
    const { request, calls } = reader();
    const root = renderAdvancedPanel(request, undefined, false, area);
    document.body.append(root);
    await tick();
    expect([...new Set(calls)].sort()).toEqual([...reads].sort());
    for (const heading of headings) expect(root.textContent).toContain(heading);
    const foreign = [
      'Почему сайт идёт так?',
      'Временные правила',
      'Профили и восстановление',
      'Устройства',
    ].filter((text) => !headings.includes(text as never));
    for (const heading of foreign)
      expect(
        [...root.querySelectorAll('h3')].map((h) => h.textContent),
      ).not.toContain(heading);
    expect(root.querySelector('select[aria-label="Тема"]')).toBeNull();
    expect(root.textContent).not.toContain('Forkop Next');
  },
);
it('shows configured device route labels without claiming online status', async () => {
  const { request, calls } = reader();
  const root = renderDeviceProfileTools(request, request, 'devices');
  document.body.append(root);
  await tick();
  expect(root.textContent).toContain('192.168.1.7 → Домашний VPN');
  expect(root.textContent).not.toContain('→ vpn');
  expect(root.textContent).toContain(
    'не подтверждает, что устройство сейчас онлайн',
  );
  expect(calls).not.toContain('profile_list');
  expect(root.querySelector('textarea')).toBeNull();
});
it('keeps profile exchange independent of device and route reads', async () => {
  const { request, calls } = reader();
  const root = renderDeviceProfileTools(request, request, 'profiles');
  document.body.append(root);
  await tick();
  expect(calls).toEqual(['profile_list']);
  expect(root.textContent).toContain('Импорт и экспорт профилей');
  expect(root.querySelector('[aria-label="Адрес устройства"]')).toBeNull();
});
it('refreshes device route choices using a fresh request without replacing entered addresses', async () => {
  let fail = true;
  const request: Request = async (action) =>
    action === 'status' && fail
      ? { success: false, error: 'offline' }
      : {
          success: true,
          data:
            action === 'status'
              ? { sections: [{ name: 'vpn', label: 'Recovered route' }] }
              : { items: [] },
        };
  let cached: ReturnType<Request> | undefined;
  const initial: Request = (action, payload) =>
    action === 'status'
      ? (cached ||= request(action, payload))
      : request(action, payload);
  const root = renderDeviceProfileTools(request, initial, 'devices');
  document.body.append(root);
  await tick();
  const field = root.querySelector<HTMLInputElement>(
    '[aria-label="Адрес устройства"]',
  )!;
  field.value = '192.168.1.42';
  fail = false;
  [...root.querySelectorAll('button')]
    .find((b) => b.textContent === 'Обновить маршруты')!
    .click();
  await tick();
  expect(
    root.querySelector('[aria-label="Маршрут устройства"]')?.textContent,
  ).toContain('Recovered route');
  expect(field.value).toBe('192.168.1.42');
});
