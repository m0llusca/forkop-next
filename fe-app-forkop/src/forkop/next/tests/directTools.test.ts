// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { renderDeviceProfileTools } from '../tools';
type TestResponse = { success: boolean; data?: unknown; error?: string };
const tick = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
const get = <T extends HTMLElement>(root: HTMLElement, label: string) =>
  root.querySelector<T>(`[aria-label="${label}"]`)!;
const click = (root: HTMLElement, text: string) => {
  const b = [...root.querySelectorAll('button')].find(
    (b) => b.textContent === text,
  );
  expect(b).toBeDefined();
  b!.click();
};
afterEach(() => document.body.replaceChildren());
function fixture(error = '') {
  const writes: unknown[] = [];
  const request = async (action: string, payload: Record<string, unknown>) => {
    if (action === 'status')
      return {
        success: true,
        data: {
          sections: [
            { name: 'vpn', label: 'Home', action: 'connection' },
            { name: 'dns', label: 'DNS', action: 'dns' },
            { name: 'zap', label: 'Zapret', action: 'zapret' },
          ],
        },
      };
    if (action === 'devices')
      return {
        success: true,
        data: { items: [{ address: '192.168.1.8', section: 'vpn' }] },
      };
    if (action === 'profile_list')
      return { success: true, data: { items: [] } };
    writes.push([action, payload]);
    return error ? { success: false, error } : { success: true };
  };
  const root = renderDeviceProfileTools(request);
  document.body.append(root);
  return { root, writes };
}
it('edits an existing assignment then resets it using the empty inherit API value', async () => {
  const { root, writes } = fixture();
  await tick();
  click(root, 'Изменить');
  expect(get<HTMLInputElement>(root, 'Адрес устройства').value).toBe(
    '192.168.1.8',
  );
  expect(get<HTMLSelectElement>(root, 'Маршрут устройства').value).toBe('vpn');
  get<HTMLSelectElement>(root, 'Маршрут устройства').value = 'inherit';
  click(root, 'Сохранить маршрут устройства');
  await tick();
  expect(writes).toEqual([
    ['device_set', { address: '192.168.1.8', section: '' }],
  ]);
});
it('resets directly from a device row without requiring the form', async () => {
  const { root, writes } = fixture();
  await tick();
  click(root, 'По общим правилам');
  await tick();
  expect(writes).toEqual([
    ['device_set', { address: '192.168.1.8', section: '' }],
  ]);
});
it('does not confuse a placeholder with inherit and explains unsupported IPv6 before sending', async () => {
  const { root, writes } = fixture();
  await tick();
  get<HTMLInputElement>(root, 'Адрес устройства').value = '192.168.1.8';
  click(root, 'Сохранить маршрут устройства');
  await tick();
  expect(writes).toEqual([]);
  get<HTMLInputElement>(root, 'Адрес устройства').value = '2001:db8::8';
  get<HTMLSelectElement>(root, 'Маршрут устройства').value = 'direct';
  click(root, 'Сохранить маршрут устройства');
  await tick();
  expect(writes).toEqual([]);
  expect(get(root, 'Результат устройства').textContent).toContain('IPv4');
});
it('requires explicit gaming scope, preserves selected-device scope on empty input, and previews all-device scope', async () => {
  const { root, writes } = fixture();
  await tick();
  get<HTMLSelectElement>(root, 'Игровой пресет').value = 'steam';
  get<HTMLSelectElement>(root, 'Игровой маршрут').value = 'vpn';
  click(root, 'Применить игровой пресет');
  await tick();
  expect(writes).toEqual([]);
  const scope = get<HTMLSelectElement>(root, 'Охват игрового пресета');
  expect(scope).toBeTruthy();
  scope.value = 'selected';
  scope.dispatchEvent(new Event('change'));
  click(root, 'Применить игровой пресет');
  await tick();
  expect(writes).toEqual([]);
  scope.value = 'all';
  scope.dispatchEvent(new Event('change'));
  expect(root.textContent).toContain('Этот пресет затронет все устройства');
  expect(get(root, 'Предварительный охват пресета').textContent).toContain(
    'Home',
  );
  click(root, 'Применить игровой пресет');
  await tick();
  expect(writes).toEqual([
    ['gaming_apply', { preset: 'steam', section: 'vpn' }],
  ]);
});
it('offers only supported gaming targets without changing configuration', async () => {
  const { root, writes } = fixture();
  await tick();
  const select = get<HTMLSelectElement>(root, 'Игровой маршрут');
  expect([...select.options].map((option) => option.value)).toEqual([
    '',
    'vpn',
  ]);
  select.value = 'vpn';
  select.dispatchEvent(new Event('change'));
  expect(writes).toEqual([]);
});
it.each([
  'native_pending_changes',
  'native_mutation_busy',
  'native_refresh_required',
])('explains %s beside the device action', async (error) => {
  const { root } = fixture(error);
  await tick();
  get<HTMLInputElement>(root, 'Адрес устройства').value = '192.168.1.8';
  get<HTMLSelectElement>(root, 'Маршрут устройства').value = 'direct';
  click(root, 'Сохранить маршрут устройства');
  await tick();
  const text = get(root, 'Результат устройства').textContent;
  expect(text).not.toBe(error);
  expect(text).toMatch(/изменени|применени|редактор/);
});
it('keeps the latest device read and marks old data after refresh failure', async () => {
  let firstResolve!: (r: TestResponse) => void;
  let reads = 0;
  const first = new Promise<TestResponse>((r) => (firstResolve = r));
  const request = async (action: string) =>
    action === 'devices'
      ? ++reads === 1
        ? first
        : reads === 2
          ? {
              success: true,
              data: { items: [{ address: '192.168.1.20', section: 'vpn' }] },
            }
          : { success: false, error: 'offline' }
      : { success: true, data: { items: [], sections: [] } };
  const root = renderDeviceProfileTools(request);
  document.body.append(root);
  click(root, 'Обновить устройства');
  await tick();
  firstResolve({
    success: true,
    data: { items: [{ address: '192.168.1.8', section: 'vpn' }] },
  });
  await tick();
  expect(root.querySelector('ul')!.textContent).toContain('192.168.1.20');
  expect(root.querySelector('ul')!.textContent).not.toContain('192.168.1.8');
  click(root, 'Обновить устройства');
  await tick();
  expect(root.querySelector('ul')!.textContent).toContain('192.168.1.20');
  expect(get(root, 'Результат устройства').textContent).toMatch(
    /обновлен|обновлён|данные/,
  );
});
it('keeps legacy IPv6 and subnet assignments and sends their editing to the native rule instead of device_set', async () => {
  const writes: unknown[] = [];
  const request = async (action: string, payload: Record<string, unknown>) => {
    if (action === 'devices')
      return {
        success: true,
        data: {
          items: [
            { address: '2001:db8::8', section: 'vpn' },
            { address: '192.168.1.0/24', section: 'vpn' },
          ],
        },
      };
    if (action === 'status')
      return {
        success: true,
        data: {
          sections: [{ name: 'vpn', label: 'VPN', action: 'connection' }],
        },
      };
    if (action === 'profile_list')
      return { success: true, data: { items: [] } };
    writes.push([action, payload]);
    return { success: true };
  };
  const root = renderDeviceProfileTools(request);
  document.body.append(root);
  await tick();
  const rows = [...root.querySelectorAll('li')];
  expect(rows).toHaveLength(2);
  for (const row of rows) {
    expect(row.textContent).toContain('полном редакторе');
    expect(
      [...row.querySelectorAll('button')].some(
        (b) => b.textContent === 'По общим правилам',
      ),
    ).toBe(false);
  }
  expect(writes).toEqual([]);
});
it.each(['success', 'failure'])(
  'ignores an older profile read %s after a fresh refresh and keeps the latest choice',
  async (kind) => {
    let finish!: (value: TestResponse) => void;
    let count = 0;
    const old = new Promise<TestResponse>((r) => (finish = r));
    const request = async (action: string) =>
      action === 'profile_list'
        ? ++count === 1
          ? old
          : { success: true, data: { items: [{ name: 'Fresh' }] } }
        : { success: true, data: { items: [], sections: [] } };
    const root = renderDeviceProfileTools(request, request, 'profiles');
    document.body.append(root);
    click(root, 'Обновить профили');
    await tick();
    const status = get(root, 'Результат профиля').textContent;
    finish(
      kind === 'success'
        ? { success: true, data: { items: [{ name: 'Old' }] } }
        : { success: false, error: 'obsolete failure' },
    );
    await tick();
    expect(get(root, 'Профиль для экспорта').textContent).toContain('Fresh');
    expect(get(root, 'Профиль для экспорта').textContent).not.toContain('Old');
    expect(get(root, 'Результат профиля').textContent).toBe(status);
  },
);
it('shows generated direct assignments as always direct and never as inherit', async () => {
  const request = async (action: string) => ({
    success: true,
    data:
      action === 'status'
        ? { sections: [{ name: 'nxt_direct', action: 'bypass' }] }
        : {
            items:
              action === 'devices'
                ? [{ address: '192.168.1.8', section: 'nxt_direct' }]
                : [],
          },
  });
  const root = renderDeviceProfileTools(request);
  document.body.append(root);
  await tick();
  expect(root.querySelector('li')!.textContent).toContain('Всегда напрямую');
  expect(root.querySelector('li')!.textContent).not.toContain('nxt_direct');
  click(root, 'Изменить');
  expect(get<HTMLSelectElement>(root, 'Маршрут устройства').value).toBe(
    'direct',
  );
});
