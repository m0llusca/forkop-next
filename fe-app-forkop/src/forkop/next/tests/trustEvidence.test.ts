// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { renderCompatibilityPanel } from '../compatibility';
import { renderAdvancedPanel, type Request } from '../advanced';
const tick = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
const capability = (event: Event) =>
  (event as CustomEvent).detail.provide({
    targets: [
      { name: 'main', localProxyConfigured: true },
      { name: 'other', localProxyConfigured: true },
    ],
  });
beforeEach(() =>
  document.body.addEventListener('forkop:workflow-context', capability),
);
afterEach(() => {
  document.body.removeEventListener('forkop:workflow-context', capability);
  document.body.replaceChildren();
});
const button = (name: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent === name)!;
const status = {
  success: true,
  data: {
    digest: 'current',
    recovery_pending: false,
    previous_available: true,
    sections: [
      { name: 'main', label: 'Основное', action: 'connection' },
      { name: 'other', label: 'Другое', action: 'connection' },
    ],
  },
};
const verified = {
  success: true,
  data: {
    status: 'verified',
    outbounds: [
      { outbound_tag: 'one', label: 'Первый' },
      { outbound_tag: 'two', label: 'Второй' },
    ],
    checks: [],
    probe: { reachable: true, http_status: 200 },
  },
};
it.each(['outbound', 'domain', 'JSON'])(
  'invalidates verified compatibility after editing %s without leaking JSON',
  async (field) => {
    document.body.append(
      renderCompatibilityPanel(async (action) =>
        action === 'status' ? status : verified,
      ),
    );
    await tick();
    button('Сопоставить настройки').click();
    await tick();
    const domain = document.querySelector<HTMLInputElement>(
      '[name=compatibility_domain]',
    )!;
    domain.value = 'example.org';
    button('Проверить соединение').click();
    await tick();
    expect(document.body.textContent).toContain('Соединение проверено');
    expect(document.body.textContent).toContain('example.org');
    expect(document.body.textContent).toContain('с роутера');
    expect(document.body.textContent).toContain('Первый');
    const target =
      field === 'outbound'
        ? document.querySelectorAll('select')[1]
        : field === 'domain'
          ? domain
          : document.querySelector('textarea')!;
    target.value =
      field === 'outbound'
        ? 'two'
        : field === 'domain'
          ? 'changed.example'
          : '{"password":"never-display-me"}';
    target.dispatchEvent(
      new Event(field === 'outbound' ? 'change' : 'input', { bubbles: true }),
    );
    expect(document.body.textContent).toContain(
      'Параметры изменены — проверьте снова',
    );
    expect(
      document.querySelector('.fkp-next-result')?.textContent,
    ).not.toContain('Соединение проверено');
    expect(document.body.textContent).not.toContain('never-display-me');
  },
);
it('rejects a late compatibility success after input changes', async () => {
  let finish!: (v: typeof verified) => void;
  document.body.append(
    renderCompatibilityPanel(async (action) =>
      action === 'status'
        ? status
        : new Promise((resolve) => {
            finish = resolve;
          }),
    ),
  );
  await tick();
  button('Сопоставить настройки').click();
  await tick();
  const json = document.querySelector('textarea')!;
  json.value = '{}';
  json.dispatchEvent(new Event('input'));
  finish(verified);
  await tick();
  expect(document.querySelector('.fkp-next-result')?.textContent).toContain(
    'Параметры изменены — проверьте снова',
  );
});
it('keeps the latest compatibility result when A completes after B', async () => {
  const finish: Array<(v: Awaited<ReturnType<Request>>) => void> = [];
  document.body.append(
    renderCompatibilityPanel(async (action) =>
      action === 'status'
        ? status
        : new Promise((resolve) => finish.push(resolve)),
    ),
  );
  await tick();
  button('Сопоставить настройки').click();
  await tick();
  const domain = document.querySelector<HTMLInputElement>(
    '[name=compatibility_domain]',
  )!;
  domain.value = 'b.example';
  domain.dispatchEvent(new Event('input'));
  button('Сопоставить настройки').click();
  await tick();
  finish[1](verified);
  await tick();
  finish[0]({ success: true, data: { status: 'unsupported', outbounds: [] } });
  await tick();
  expect(document.querySelector('.fkp-next-result')?.textContent).toContain(
    'Соединение проверено',
  );
  expect(document.querySelector('.fkp-next-result')?.textContent).toContain(
    'b.example',
  );
});
it('offers recover directly while lazy rule tools remain closed', async () => {
  const calls: string[] = [];
  const root = renderAdvancedPanel(
    async (action) => {
      calls.push(action);
      return action === 'status'
        ? { ...status, data: { ...status.data, recovery_pending: true } }
        : { success: true };
    },
    undefined,
    true,
    'rules',
  );
  document.body.append(root);
  await tick();
  const recover = [...root.querySelectorAll('button')].find(
    (b) => b.textContent === 'Восстановить прерванное применение',
  );
  expect(recover).toBeDefined();
  expect(recover!.closest('details')).toBeNull();
  recover!.click();
  await tick();
  expect(calls).toContain('recover');
});
it('invalidates a completed Smart Detect comparison after its target changes', async () => {
  document.body.append(
    renderAdvancedPanel(
      async (action) =>
        action === 'status'
          ? status
          : action === 'recommendation_scan'
            ? {
                success: true,
                data: {
                  current: { reachable: false },
                  section: { reachable: true },
                },
              }
            : { success: true, data: { items: [] } },
      undefined,
      false,
      'rules',
    ),
  );
  await tick();
  const domain = document.querySelector<HTMLInputElement>(
    '[name=recommendation_domain]',
  )!;
  domain.value = 'a.example';
  button('Проверить другой маршрут').click();
  await tick();
  const result = [...document.querySelectorAll('.fkp-next-result')].find((n) =>
    n.textContent?.includes('Текущий маршрут:'),
  )!;
  domain.value = 'b.example';
  domain.dispatchEvent(new Event('input'));
  expect(result.textContent).toContain('Параметры изменены — проверьте снова');
});
it('keeps the newer diagnostic probe when an older response arrives last and invalidates on route edits', async () => {
  const finish: Array<(v: Awaited<ReturnType<Request>>) => void> = [];
  document.body.append(
    renderAdvancedPanel(
      async (action) =>
        action === 'status'
          ? status
          : action === 'probe'
            ? new Promise((resolve) => finish.push(resolve))
            : { success: true, data: { items: [] } },
      undefined,
      false,
      'diagnostics',
    ),
  );
  await tick();
  const domain = document.querySelector<HTMLInputElement>('[name=domain]')!;
  domain.value = 'a.example';
  button('Проверить доступность').click();
  await tick();
  domain.value = 'b.example';
  domain.dispatchEvent(new Event('input'));
  // A new request may be started once parameters change, even while A is pending.
  button('Проверить доступность').click();
  await tick();
  expect(finish).toHaveLength(2);
  finish[1]({ success: true, data: { reachable: true, http_status: 200 } });
  await tick();
  finish[0]({ success: true, data: { reachable: false, http_status: 500 } });
  await tick();
  const result = [...document.querySelectorAll('.fkp-next-result')].find((n) =>
    n.textContent?.includes('b.example'),
  )!;
  expect(result.textContent).toContain('Сайт доступен');
  expect(result.textContent).toContain('с роутера');
  const route = [...document.querySelectorAll('label')]
    .find((n) => n.textContent?.startsWith('Маршрут проверки'))!
    .querySelector('select')!;
  route.value = 'other';
  route.dispatchEvent(new Event('change'));
  expect(result.textContent).toContain('Параметры изменены — проверьте снова');
});
it.each([true, false])(
  'offers transaction recovery separately and retains result/retry after recovery success=%s',
  async (success) => {
    let pending = true;
    const calls: string[] = [];
    document.body.append(
      renderAdvancedPanel(
        async (action) => {
          calls.push(action);
          if (action === 'status')
            return {
              ...status,
              data: { ...status.data, recovery_pending: pending },
            };
          if (action === 'recover') {
            if (success) pending = false;
            return success
              ? { success: true }
              : { success: false, error: 'activation_failed' };
          }
          return { success: true, data: { items: [] } };
        },
        undefined,
        false,
        'settings',
      ),
    );
    await tick();
    expect(document.body.textContent).toContain('Применение было прервано');
    expect(button('Вернуть предыдущую конфигурацию').disabled).toBe(true);
    button('Восстановить прерванное применение').click();
    await tick();
    expect(calls).toContain('recover');
    expect(calls).not.toContain('rollback');
    if (success) {
      expect(document.body.textContent).toContain(
        'Прерванное применение восстановлено',
      );
      expect(button('Вернуть предыдущую конфигурацию').disabled).toBe(false);
    } else {
      expect(document.body.textContent).toContain('activation_failed');
      expect(document.body.textContent).toContain('Повторите восстановление');
      expect(button('Восстановить прерванное применение').disabled).toBe(false);
    }
  },
);
