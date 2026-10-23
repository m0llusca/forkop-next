// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderNextPanel } from '../render';
const tick = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});
function setup() {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const request = async (
    action: string,
    payload: Record<string, unknown> = {},
  ) => {
    calls.push([action, payload]);
    if (action === 'status')
      return {
        success: true,
        data: {
          digest: 'abc123',
          sections: [{ name: 'main', label: 'Основное' }],
          previous_available: true,
          versions: { forkop: 'next-dev', sing_box: '1.13.18' },
        },
      };
    if (action === 'probe')
      return {
        success: true,
        data: {
          reachable: false,
          http_status: 403,
          checked_at: 1792752000,
          route: 'current',
          limitation: 'network_probe_only',
        },
      };
    if (action === 'profile_list')
      return { success: true, data: { items: [{ name: 'home' }] } };
    if (action === 'profile_diff')
      return { success: true, data: { changes: ['section main: changed'] } };
    if (action === 'route_explain')
      return {
        success: true,
        data: {
          connectivity_tested: false,
          decision: { status: 'matched', section: 'main' },
          trace: [{ section: 'main', reason: 'domain match' }],
        },
      };
    if (action === 'recommendations')
      return {
        success: true,
        data: {
          items: [
            {
              id: 'r1',
              domain: 'example.org',
              current_route_failures: 3,
              proxy_successes: 3,
            },
          ],
        },
      };
    return { success: true, data: { items: [] } };
  };
  const panel = renderNextPanel(request);
  document.body.append(panel);
  return { panel, calls };
}
const button = (text: string) =>
  [...document.querySelectorAll('button')].find((x) => x.textContent === text)!;
describe('Next control panel', () => {
  it('shows real versions and keeps configuration detail behind an explicit mode', async () => {
    const { panel } = setup();
    await tick();
    expect(panel.textContent).toContain('1.13.18');
    expect(panel.dataset.mode).toBe('simple');
    button('Подробный режим').click();
    expect(panel.dataset.mode).toBe('detailed');
  });
  it('explains a route without silently running a connectivity probe', async () => {
    const { calls } = setup();
    await tick();
    (document.querySelector('[name="domain"]') as HTMLInputElement).value =
      'example.org';
    button('Объяснить маршрут').click();
    await tick();
    expect(calls.filter(([a]) => a === 'route_explain')).toEqual([
      [
        'route_explain',
        { domain: 'example.org', device: '', port: 443, protocol: 'tcp' },
      ],
    ]);
    expect(calls.some(([a]) => a.includes('probe'))).toBe(false);
    expect(document.body.textContent).toContain(
      'Доступность сайта не проверялась',
    );
  });
  it('requires a profile preview before applying with its configuration digest', async () => {
    const { calls } = setup();
    await tick();
    expect(button('Применить профиль').disabled).toBe(true);
    button('Сравнить профиль').click();
    await tick();
    expect(button('Применить профиль').disabled).toBe(false);
    button('Применить профиль').click();
    await tick();
    expect(calls).toContainEqual([
      'profile_apply',
      { name: 'home', expected: 'abc123' },
    ]);
  });
  it('only accepts a Smart Detect proposal on explicit user action', async () => {
    const { calls } = setup();
    await tick();
    expect(calls.some(([a]) => a === 'recommendation_accept')).toBe(false);
    expect(document.body.textContent).toContain('ошибки текущего маршрута: 3');
    button('Принять рекомендацию').click();
    await tick();
    expect(calls).toContainEqual([
      'recommendation_accept',
      { id: 'r1', section: 'main' },
    ]);
  });
  it('submits temporary rules with a bounded lifetime and chosen section', async () => {
    const { calls } = setup();
    await tick();
    (
      document.querySelector('[name="temporary_domain"]') as HTMLInputElement
    ).value = 'example.org';
    button('Добавить временное правило').click();
    await tick();
    expect(calls).toContainEqual([
      'temporary_add',
      { domain: 'example.org', section: 'main', ttl: 3600 },
    ]);
  });
});

it('invalidates the preview after applying rather than reusing its digest', async () => {
  setup();
  await tick();
  button('Сравнить профиль').click();
  await tick();
  button('Применить профиль').click();
  await tick();
  expect(button('Применить профиль').disabled).toBe(true);
});

it('keeps route trace collapsed in simple mode and reveals it in detailed mode', async () => {
  setup();
  await tick();
  (document.querySelector('[name="domain"]') as HTMLInputElement).value =
    'example.org';
  button('Объяснить маршрут').click();
  await tick();
  const trace = document.querySelector('.fkp-next-result ol') as HTMLElement;
  expect(trace.hidden).toBe(true);
  button('Подробный режим').click();
  expect(trace.hidden).toBe(false);
});
it('refreshes saved profiles when an import event arrives from child controls', async () => {
  const { panel, calls } = setup();
  await tick();
  const before = calls.filter(([a]) => a === 'profile_list').length;
  panel.dispatchEvent(
    new CustomEvent('forkop:profiles-changed', { bubbles: true }),
  );
  await tick();
  expect(calls.filter(([a]) => a === 'profile_list').length).toBe(before + 1);
});

it('only probes after explicit action and reports unreachable separately from command success', async () => {
  const { calls } = setup();
  await tick();
  expect(calls.some(([a]) => a === 'probe')).toBe(false);
  (document.querySelector('[name="domain"]') as HTMLInputElement).value =
    'example.org';
  button('Проверить доступность').click();
  await tick();
  expect(calls).toContainEqual(['probe', { domain: 'example.org' }]);
  expect(document.body.textContent).toContain('Сайт недоступен');
  expect(document.body.textContent).toContain('403');
});

it('does not authorize applying a different profile while a comparison is still loading', async () => {
  let finish!: (value: { success: boolean; data: unknown }) => void;
  const pending = new Promise<{ success: boolean; data: unknown }>(
    (resolve) => (finish = resolve),
  );
  const panel = renderNextPanel(async (action) =>
    action === 'profile_diff'
      ? pending
      : action === 'profile_list'
        ? {
            success: true,
            data: { items: [{ name: 'home' }, { name: 'reserve' }] },
          }
        : action === 'status'
          ? {
              success: true,
              data: { digest: 'abc123', versions: {}, sections: [] },
            }
          : { success: true, data: { items: [] } },
  );
  document.body.append(panel);
  await tick();
  button('Сравнить профиль').click();
  const selection = [...panel.querySelectorAll('select')].find(
    (s) => s.options[0]?.value === 'home',
  )!;
  selection.value = 'reserve';
  selection.dispatchEvent(new Event('change'));
  finish({
    success: true,
    data: { changed: ['main'], current_digest: 'abc123' },
  });
  await tick();
  expect(button('Применить профиль').disabled).toBe(true);
});

it('translates routing decisions and uses the configured connection label', async () => {
  setup();
  await tick();
  (document.querySelector('[name="domain"]') as HTMLInputElement).value =
    'example.org';
  button('Объяснить маршрут').click();
  await tick();
  expect(document.querySelector('.fkp-next-result')?.textContent).toContain(
    'Правило найдено → Основное',
  );
});

it('shows failed list reads as errors instead of empty-state claims and allows retry', async () => {
  let fail = true;
  const panel = renderNextPanel(async (action) =>
    action === 'status'
      ? { success: true, data: { versions: {}, sections: [] } }
      : fail
        ? { success: false, error: 'offline' }
        : { success: true, data: { items: [] } },
  );
  document.body.append(panel);
  await tick();
  expect(panel.textContent).not.toContain('Временных правил нет.');
  expect(panel.textContent).not.toContain('Рекомендаций пока нет.');
  expect(panel.textContent).toContain('Не удалось загрузить');
  fail = false;
  button('Обновить данные').click();
  await tick();
  expect(panel.textContent).toContain('Временных правил нет.');
  expect(panel.textContent).toContain('Рекомендаций пока нет.');
});
it('keeps previously loaded temporary rules visible when refreshing fails', async () => {
  let fail = false;
  const panel = renderNextPanel(async (action) =>
    action === 'status'
      ? { success: true, data: { versions: {}, sections: [] } }
      : action === 'temporary_list'
        ? fail
          ? { success: false, error: 'offline' }
          : {
              success: true,
              data: {
                items: [
                  {
                    id: 'one',
                    domain: 'example.org',
                    section: 'main',
                    expires: 1792752000,
                  },
                ],
              },
            }
        : { success: true, data: { items: [] } },
  );
  document.body.append(panel);
  await tick();
  fail = true;
  button('Обновить данные').click();
  await tick();
  expect(panel.textContent).toContain('example.org → main');
  expect(panel.textContent).toContain('Не удалось загрузить');
});

it('runs a Smart Detect comparison only on request for the entered site and target connection', async () => {
  const { calls } = setup();
  await tick();
  expect(calls.some(([a]) => a === 'recommendation_scan')).toBe(false);
  const domain = document.querySelector(
    '[name=recommendation_domain]',
  ) as HTMLInputElement;
  expect(domain).not.toBeNull();
  domain.value = 'example.org';
  button('Проверить другой маршрут').click();
  await tick();
  expect(calls).toContainEqual([
    'recommendation_scan',
    { domain: 'example.org', section: 'main' },
  ]);
  expect(document.body.textContent).toContain('ошибки текущего маршрута');
  expect(document.body.textContent).not.toContain('ошибки напрямую');
});

it('shows actual selected servers from the existing dashboard data rather than invented live values', async () => {
  const panel = renderNextPanel(
    async (action) =>
      action === 'status'
        ? { success: true, data: { versions: {}, sections: [] } }
        : { success: true, data: { items: [] } },
    async () => ({
      success: true,
      data: [
        {
          displayName: 'Основное',
          outbounds: [{ displayName: 'Сервер1', selected: true, latency: 54 }],
        },
      ],
    }),
  );
  document.body.append(panel);
  await tick();
  expect(panel.textContent).toContain('Основное: Сервер1 · 54 мс');
});

it('keeps automatic Smart Detect opt-in and saves only the explicitly selected setting', async () => {
  const { calls } = setup();
  await tick();
  const toggle = document.querySelector(
    '[name=smart_detect_enabled]',
  ) as HTMLInputElement;
  expect(toggle).not.toBeNull();
  expect(toggle.checked).toBe(false);
  expect(calls.some(([a]) => a === 'smart_detect_configure')).toBe(false);
  toggle.checked = true;
  button('Сохранить автоматический поиск').click();
  await tick();
  expect(calls).toContainEqual([
    'smart_detect_configure',
    { enabled: true, section: 'main' },
  ]);
});
it('explains that automatic comparison requires a local SOCKS inbound when backend rejects the target', async () => {
  const panel = renderNextPanel(async (action) =>
    action === 'status'
      ? {
          success: true,
          data: {
            versions: {},
            sections: [{ name: 'main', label: 'Основное' }],
            smart_detect: { enabled: false, section: '' },
          },
        }
      : action === 'smart_detect_configure'
        ? { success: false, error: 'section_probe_unavailable' }
        : { success: true, data: { items: [] } },
  );
  document.body.append(panel);
  await tick();
  (
    panel.querySelector('[name=smart_detect_enabled]') as HTMLInputElement
  ).checked = true;
  button('Сохранить автоматический поиск').click();
  await tick();
  expect(panel.textContent).toContain('Включите локальный SOCKS');
});
