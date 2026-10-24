// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderDeviceProfileTools } from '../tools';

const wait = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};
const control = <T extends HTMLElement>(root: HTMLElement, label: string) =>
  root.querySelector<T>(`[aria-label="${label}"]`)!;
const click = (root: HTMLElement, text: string) => {
  const button = [...root.querySelectorAll('button')].find(
    (item) => item.textContent === text,
  );
  expect(button, `Button ${text} exists`).toBeTruthy();
  button!.click();
};
function fixture(
  overrides: Record<
    string,
    { success: boolean; data?: unknown; error?: string }
  > = {},
) {
  const writes: Array<[string, Record<string, unknown>]> = [];
  const request = async (action: string, payload: Record<string, unknown>) => {
    if (action in overrides) return overrides[action];
    if (action === 'devices')
      return {
        success: true,
        data: { items: [{ address: '192.168.1.8', section: 'vpn' }] },
      };
    if (action === 'status')
      return {
        success: true,
        data: {
          sections: [{ name: 'vpn', label: 'Home VPN', action: 'proxy' }],
        },
      };
    if (action === 'profile_list')
      return { success: true, data: { items: [{ name: 'Home' }] } };
    writes.push([action, payload]);
    if (action === 'profile_export')
      return {
        success: true,
        data: {
          name: 'Home',
          config: "config forkop 'main'\n option token 'private'\n",
        },
      };
    return { success: true, data: {} };
  };
  const root = renderDeviceProfileTools(request);
  document.body.append(root);
  return { root, writes };
}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('device and profile controls', () => {
  it('lets a device explicitly bypass proxy routes', async () => {
    const { root, writes } = fixture();
    await wait();
    control<HTMLInputElement>(root, 'Адрес устройства').value = '192.168.1.40';
    control<HTMLSelectElement>(root, 'Маршрут устройства').value = 'direct';
    click(root, 'Сохранить маршрут устройства');
    await wait();
    expect(writes).toContainEqual([
      'device_set',
      { address: '192.168.1.40', section: 'direct' },
    ]);
  });
  it('notifies the surrounding profile panel after a successful import', async () => {
    const { root } = fixture();
    await wait();
    const changes: Event[] = [];
    root.parentElement!.addEventListener('forkop:profiles-changed', (event) =>
      changes.push(event),
    );
    control<HTMLInputElement>(root, 'Название импортируемого профиля').value =
      'Travel';
    control<HTMLTextAreaElement>(root, 'Конфигурация профиля').value =
      "config forkop 'main'\n";
    click(root, 'Импортировать профиль');
    await wait();
    expect(changes).toHaveLength(1);
  });
  it('loads routes and persists an explicit device route through the API', async () => {
    const { root, writes } = fixture();
    await wait();
    expect(root.textContent).toContain('192.168.1.8');
    control<HTMLInputElement>(root, 'Адрес устройства').value = '192.168.1.20';
    control<HTMLSelectElement>(root, 'Маршрут устройства').value = 'vpn';
    click(root, 'Сохранить маршрут устройства');
    await wait();
    expect(writes).toContainEqual([
      'device_set',
      { address: '192.168.1.20', section: 'vpn' },
    ]);
    expect(control(root, 'Результат устройства').textContent).toContain(
      'сохранён',
    );
  });
  it('applies the selected gaming store preset to the explicit device and route', async () => {
    const { root, writes } = fixture();
    await wait();
    control<HTMLSelectElement>(root, 'Охват игрового пресета').value =
      'selected';
    control<HTMLInputElement>(root, 'Игровое устройство').value =
      '192.168.1.30';
    control<HTMLSelectElement>(root, 'Игровой пресет').value = 'xbox';
    control<HTMLSelectElement>(root, 'Игровой маршрут').value = 'vpn';
    click(root, 'Применить игровой пресет');
    await wait();
    expect(writes).toContainEqual([
      'gaming_apply',
      { preset: 'xbox', device: '192.168.1.30', section: 'vpn' },
    ]);
    expect(root.textContent).toContain(
      'Игровые сессии сохраняют текущую маршрутизацию',
    );
  });
  it('exports secrets only after explicit export, downloads and revokes the temporary URL', async () => {
    const created: Blob[] = [];
    const revoked: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      created.push(blob as Blob);
      return 'blob:profile';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) =>
      revoked.push(url),
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { root, writes } = fixture();
    await wait();
    expect(writes).toEqual([]);
    expect(root.textContent).not.toContain("option token 'private'");
    control<HTMLSelectElement>(root, 'Профиль для экспорта').value = 'Home';
    click(root, 'Скачать профиль');
    await wait();
    expect(writes).toEqual([['profile_export', { name: 'Home' }]]);
    expect(await created[0].text()).toContain("option token 'private'");
    await vi.waitFor(() => expect(revoked).toEqual(['blob:profile']));
    expect(root.textContent).not.toContain("option token 'private'");
  });
  it('imports named raw UCI without activating a profile', async () => {
    const { root, writes } = fixture();
    await wait();
    control<HTMLInputElement>(root, 'Название импортируемого профиля').value =
      'Travel';
    control<HTMLTextAreaElement>(root, 'Конфигурация профиля').value =
      "config forkop 'main'\n";
    click(root, 'Импортировать профиль');
    await wait();
    expect(writes).toEqual([
      ['profile_import', { name: 'Travel', config: "config forkop 'main'\n" }],
    ]);
    expect(control(root, 'Результат профиля').textContent).toContain(
      'импортирован',
    );
  });
  it('reads an imported file without submitting it automatically', async () => {
    const { root, writes } = fixture();
    await wait();
    const file = new File(["config forkop 'file'\n"], 'Travel.uci');
    const input = control<HTMLInputElement>(root, 'Файл профиля');
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await wait();
    expect(
      control<HTMLTextAreaElement>(root, 'Конфигурация профиля').value,
    ).toBe("config forkop 'file'\n");
    expect(
      control<HTMLInputElement>(root, 'Название импортируемого профиля').value,
    ).toBe('Travel');
    expect(writes).toEqual([]);
  });
  it('reports failed writes without reporting success or leaking config', async () => {
    const { root } = fixture({
      profile_import: { success: false, error: 'invalid_config' },
    });
    await wait();
    control<HTMLInputElement>(root, 'Название импортируемого профиля').value =
      'Bad';
    control<HTMLTextAreaElement>(root, 'Конфигурация профиля').value = 'secret';
    click(root, 'Импортировать профиль');
    await wait();
    expect(control(root, 'Результат профиля').textContent).toContain(
      'invalid_config',
    );
    expect(control(root, 'Результат профиля').textContent).not.toContain(
      'импортирован',
    );
  });
  it('rejects empty inputs locally and shows read errors', async () => {
    const { root, writes } = fixture({
      devices: { success: false, error: 'device_read_failed' },
    });
    await wait();
    expect(root.textContent).toContain('device_read_failed');
    click(root, 'Сохранить маршрут устройства');
    click(root, 'Импортировать профиль');
    await wait();
    expect(writes).toEqual([]);
    expect(control(root, 'Результат устройства').textContent).toContain(
      'Требуются',
    );
    expect(control(root, 'Результат профиля').textContent).toContain(
      'Требуются',
    );
  });
});
