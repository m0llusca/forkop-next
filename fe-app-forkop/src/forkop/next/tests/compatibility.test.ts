// @vitest-environment happy-dom
import { afterEach, it, expect } from 'vitest';
import { renderCompatibilityPanel } from '../compatibility';
afterEach(() => document.body.replaceChildren());
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const button = (name: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent === name)!;
function setup() {
  const calls: Array<[string, Record<string, unknown>]> = [];
  document.body.append(
    renderCompatibilityPanel(async (action, payload = {}) => {
      calls.push([action, payload]);
      return action === 'status'
        ? {
            success: true,
            data: { sections: [{ name: 'main', label: 'Основное' }] },
          }
        : action === 'compatibility_updates'
          ? {
              success: true,
              data: {
                updates: [
                  {
                    component: 'xray',
                    installed: '25.1',
                    latest: '25.1',
                    status: 'unknown',
                  },
                ],
                automatic_install: false,
              },
            }
          : {
              success: true,
              data: {
                status: 'probe_required',
                outbounds: [{ outbound_tag: 'main-out', label: 'Server One' }],
                checks: [
                  {
                    capability: 'transport',
                    status: 'unknown',
                    detail: 'Need server configuration',
                    next_step: 'Provide server metadata',
                  },
                ],
                client: { version: '1.13.18' },
                server: { xray_version: '25.1' },
              },
            };
    }),
  );
  return calls;
}
it('does not treat displayed versions as verified compatibility', async () => {
  const calls = setup();
  await tick();
  expect(calls.map(([a]) => a)).toEqual(['status']);
  expect(document.body.textContent).toContain('Проверка не выполнялась');
});
it('matches metadata without a handshake until the operator explicitly requests it', async () => {
  const calls = setup();
  await tick();
  button('Сопоставить настройки').click();
  await tick();
  expect(calls).toContainEqual(['compatibility_check', { section: 'main' }]);
  expect(document.body.textContent).toContain('Нужна проверка соединения');
  const domain = document.querySelector(
    '[name=compatibility_domain]',
  ) as HTMLInputElement;
  expect(domain).not.toBeNull();
  domain.value = 'example.org';
  button('Проверить соединение').click();
  await tick();
  expect(calls).toContainEqual([
    'compatibility_check',
    {
      section: 'main',
      outbound_tag: 'main-out',
      domain: 'example.org',
      probe: true,
    },
  ]);
});
it('keeps unknown update state explicit even if version strings match', async () => {
  const calls = setup();
  await tick();
  button('Проверить обновления 3x-ui и Xray').click();
  await tick();
  expect(calls).toContainEqual(['compatibility_updates', {}]);
  expect(document.body.textContent).toContain('Статус обновления неизвестен');
  expect(document.body.textContent).toContain(
    'Автоматическая установка отключена',
  );
});
it('rejects malformed pasted metadata before invoking the backend', async () => {
  const calls = setup();
  await tick();
  document.querySelector('textarea')!.value = '{broken';
  button('Сопоставить настройки').click();
  await tick();
  expect(calls.some(([a]) => a === 'compatibility_check')).toBe(false);
  expect(document.body.textContent).toContain('Проверьте JSON');
});

it('checks update availability against explicitly supplied installed server versions', async () => {
  const calls = setup();
  await tick();
  const panel = document.querySelector(
    '[name=compatibility_panel_version]',
  ) as HTMLInputElement;
  const xray = document.querySelector(
    '[name=compatibility_xray_version]',
  ) as HTMLInputElement;
  expect(panel).not.toBeNull();
  expect(xray).not.toBeNull();
  panel.value = '2.8.0';
  xray.value = '25.1';
  button('Проверить обновления 3x-ui и Xray').click();
  await tick();
  expect(calls).toContainEqual([
    'compatibility_updates',
    { installed: { panel: '2.8.0', xray: '25.1' } },
  ]);
});
