// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { renderAdvancedPanel, type Request } from '../advanced';
import { renderCompatibilityPanel } from '../compatibility';
import { renderDeviceProfileTools } from '../tools';

const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(() => document.body.replaceChildren());
const click = (root: HTMLElement, label: string) =>
  [...root.querySelectorAll('button')]
    .find((button) => button.textContent === label)!
    .click();
const status = {
  digest: 'current-digest',
  previous_available: true,
  versions: { forkop: '2.0', sing_box: '1.14.3' },
  sections: [{ name: 'cfg0123', label: 'Рабочий VPN' }],
};
const reader: Request = async (action) => ({
  success: true,
  data: action === 'status' ? status : { items: [] },
});

it('identifies configured routes in the trace and keeps unknown IDs as plain text', async () => {
  const request: Request = async (action, payload) =>
    action === 'route_explain'
      ? {
          success: true,
          data: {
            decision: { status: 'matched', section: 'cfg0123' },
            trace: [
              { section: 'cfg0123', reason: 'domain match' },
              { section: '<legacy>', reason: 'no match' },
            ],
          },
        }
      : reader(action, payload);
  const root = renderAdvancedPanel(request, undefined, false, 'diagnostics');
  document.body.append(root);
  await tick();
  click(root, 'Объяснить маршрут');
  await tick();
  expect(root.querySelector('strong')?.textContent).toContain('Рабочий VPN');
  const trace = root.querySelector('ol')!;
  expect(trace.textContent).toContain('Рабочий VPN: domain match');
  expect(trace.textContent).not.toContain('cfg0123');
  expect(trace.textContent).toContain('<legacy>: no match');
  expect(trace.querySelector('legacy')).toBeNull();
});

it('relabels loaded temporary rules when configured route names arrive later', async () => {
  let finish!: (value: Awaited<ReturnType<Request>>) => void;
  const request: Request = async (action, payload) =>
    action === 'status'
      ? new Promise((resolve) => (finish = resolve))
      : action === 'temporary_list'
        ? {
            success: true,
            data: {
              items: [
                {
                  id: 'one',
                  domain: 'example.org',
                  section: 'cfg0123',
                  expires: 1800000000,
                },
                {
                  id: 'two',
                  domain: 'legacy.org',
                  section: 'missing',
                  expires: 1800000000,
                },
              ],
            },
          }
        : reader(action, payload);
  const root = renderAdvancedPanel(request, undefined, false, 'rules');
  document.body.append(root);
  await tick();
  finish({ success: true, data: status });
  await tick();
  expect(root.textContent).toContain('example.org → Рабочий VPN');
  expect(root.textContent).not.toContain('example.org → cfg0123');
  expect(root.textContent).toContain('legacy.org → missing');
});

it('keeps loading, recovery and failed-read notices visible while omitting embedded success versions', async () => {
  let finish!: (value: Awaited<ReturnType<Request>>) => void;
  let next = { success: true, data: status } as Awaited<ReturnType<Request>>;
  const initial: Request = async (action, payload) =>
    action === 'status'
      ? new Promise((resolve) => (finish = resolve))
      : reader(action, payload);
  const root = renderAdvancedPanel(initial, undefined, false, 'rules');
  document.body.append(root);
  const notice = root.querySelector<HTMLElement>('.fkp-next-status')!;
  expect(notice.hidden).toBe(false);
  expect(notice.textContent).toContain('Загружаем');
  finish(next);
  await tick();
  expect(notice.hidden).toBe(true);
  expect(notice.textContent).toBe('');
  // A refresh uses the supplied request, so resolve each new pending read.
  root.dispatchEvent(new Event('forkop:refresh'));
  finish({ success: false, error: 'offline' });
  await tick();
  expect(notice.hidden).toBe(false);
  expect(notice.textContent).toContain('Состояние недоступно');
  root.dispatchEvent(new Event('forkop:refresh'));
  next = { success: true, data: { ...status, recovery_pending: true } };
  finish(next);
  await tick();
  expect(notice.hidden).toBe(false);
  expect(notice.textContent).toContain('Требуется восстановление');
  expect(notice.textContent).not.toContain('sing-box');
});

it('keeps real versions in the standalone panel', async () => {
  const root = renderAdvancedPanel(reader);
  document.body.append(root);
  await tick();
  const notice = root.querySelector<HTMLElement>('.fkp-next-status')!;
  expect(notice.hidden).toBe(false);
  expect(notice.textContent).toContain('Forkop 2.0 · sing-box 1.14.3');
});

it('uses each embedded disclosure title once after mounting its form', async () => {
  const root = renderAdvancedPanel(reader, undefined, true, 'settings');
  document.body.append(root);
  for (const title of [
    'Профили и восстановление',
    'Совместимость с 3x-ui и Xray',
  ]) {
    const details = [...root.querySelectorAll('details')].find(
      (node) => node.querySelector('summary')?.textContent === title,
    )!;
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    await tick();
    expect(details.querySelector('label')).not.toBeNull();
    expect(details.textContent?.split(title)).toHaveLength(2);
  }
});

it('summarizes a profile comparison and retains the reviewed changes and digest gate in details', async () => {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const request: Request = async (action, payload = {}) => {
    calls.push([action, payload]);
    if (action === 'profile_list')
      return { success: true, data: { items: [{ name: 'Home' }] } };
    if (action === 'profile_diff')
      return {
        success: true,
        data: {
          changed: ['cfg0123.action', 'cfg0123.domain_list'],
          current_digest: 'current-digest',
          profile_digest: 'saved-digest',
        },
      };
    if (action === 'profile_apply')
      return { success: true, data: { digest: 'applied-digest' } };
    return reader(action, payload);
  };
  const root = renderAdvancedPanel(request, undefined, false, 'settings');
  document.body.append(root);
  await tick();
  click(root, 'Сравнить профиль');
  await tick();
  const output = root.querySelector('.fkp-next-panel .fkp-next-result')!;
  expect(output.querySelector('strong')?.textContent).toContain('2');
  expect(output.querySelector('strong')?.textContent).toContain('параметр');
  const details = output.querySelector('details')!;
  expect(details.open).toBe(false);
  expect(details.textContent).toContain('cfg0123.action');
  expect(details.querySelector('pre')?.textContent).toContain('saved-digest');
  expect(output.querySelector(':scope > pre')).toBeNull();
  click(root, 'Применить профиль');
  await tick();
  expect(calls).toContainEqual([
    'profile_apply',
    {
      name: 'Home',
      expected: 'current-digest',
      expected_profile: 'saved-digest',
    },
  ]);
  expect(output.querySelector('strong')?.textContent).toContain(
    'Профиль применён',
  );
});

it.each([
  [[], 'совпадает'],
  [undefined, 'Список изменений не получен'],
] as const)(
  'distinguishes an empty profile diff from a missing change list (%s)',
  async (changed, summary) => {
    const request: Request = async (action, payload) =>
      action === 'profile_diff'
        ? {
            success: true,
            data: {
              changed,
              current_digest: 'current-digest',
              profile_digest: 'saved-digest',
            },
          }
        : action === 'profile_list'
          ? { success: true, data: { items: [{ name: 'Home' }] } }
          : reader(action, payload);
    const root = renderAdvancedPanel(request, undefined, false, 'settings');
    document.body.append(root);
    await tick();
    click(root, 'Сравнить профиль');
    await tick();
    expect(
      root.querySelector('.fkp-next-panel .fkp-next-result strong')
        ?.textContent,
    ).toContain(summary);
  },
);

it('confirms saving by profile name and restoring the previous configuration without a raw primary result', async () => {
  const request: Request = async (action, payload) =>
    action === 'profile_save'
      ? { success: true, data: { name: 'Travel' } }
      : action === 'rollback'
        ? { success: true, data: { digest: 'restored-digest' } }
        : reader(action, payload);
  const root = renderAdvancedPanel(request, undefined, false, 'settings');
  document.body.append(root);
  await tick();
  root.querySelector<HTMLInputElement>('[name=profile_name]')!.value = 'Travel';
  click(root, 'Сохранить текущий профиль');
  await tick();
  const output = root.querySelector('.fkp-next-panel .fkp-next-result')!;
  expect(output.querySelector('strong')?.textContent).toContain(
    'Профиль «Travel» сохранён',
  );
  click(root, 'Вернуть предыдущую конфигурацию');
  await tick();
  expect(output.querySelector('strong')?.textContent).toContain(
    'Предыдущая конфигурация восстановлена',
  );
  expect(output.querySelector('details pre')?.textContent).toContain(
    'restored-digest',
  );
});

it('confirms a device assignment using its address and configured route label', async () => {
  const root = renderDeviceProfileTools(reader, reader, 'devices');
  document.body.append(root);
  await tick();
  root.querySelector<HTMLInputElement>(
    '[aria-label="Адрес устройства"]',
  )!.value = '192.168.1.50';
  root.querySelector<HTMLSelectElement>(
    '[aria-label="Маршрут устройства"]',
  )!.value = 'cfg0123';
  click(root, 'Сохранить маршрут устройства');
  await tick();
  expect(
    root.querySelector('[aria-label="Результат устройства"]')?.textContent,
  ).toContain('192.168.1.50 → Рабочий VPN');
});

it('names compatibility checks and states in plain language while preserving technical evidence', async () => {
  const request: Request = async (action, payload) =>
    action === 'compatibility_check'
      ? {
          success: true,
          data: {
            status: 'probe_required',
            outbounds: [],
            checks: [
              {
                capability: 'transport',
                status: 'matched',
                detail: 'Client and server metadata agree.',
              },
              {
                capability: 'runtime_probe',
                status: 'unknown',
                detail: 'A current selected-outbound handshake is required.',
                next_step: 'Run an explicit HTTPS probe.',
              },
              {
                capability: 'future_capability',
                status: 'future_state',
                detail: 'Future evidence',
              },
            ],
            client: { version: '1.14.3' },
            server: {},
          },
        }
      : reader(action, payload);
  const root = renderCompatibilityPanel(request);
  document.body.append(root);
  await tick();
  click(root, 'Сопоставить настройки');
  await tick();
  const checks = root.querySelector('.fkp-next-result ul')!;
  expect(checks.textContent).toContain('Транспорт: Настройки совпадают');
  expect(checks.textContent).toContain('Проверка соединения: Не проверено');
  expect(checks.textContent).not.toContain('runtime_probe: unknown');
  expect(checks.textContent).toContain(
    'Дополнительный параметр: Неизвестный результат',
  );
  const details = root.querySelector<HTMLDetailsElement>(
    '.fkp-next-result details',
  )!;
  expect(details.open).toBe(false);
  expect(details.textContent).toContain('future_capability');
  expect(details.textContent).toContain('future_state');
  expect(details.textContent).toContain('Run an explicit HTTPS probe.');
});
