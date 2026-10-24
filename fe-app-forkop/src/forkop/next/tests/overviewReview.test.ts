// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { renderNextPanel } from '../render';
const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const settle = () => new Promise((r) => setTimeout(r, 0));
const button = (p: HTMLElement, text: string) =>
  [...p.querySelectorAll('button')].find((b) => b.textContent === text)!;
const open = async (p: HTMLElement, title: string) => {
  const d = [...p.querySelectorAll('details')].find(
    (d) => d.firstElementChild?.textContent === title,
  )!;
  d.open = true;
  d.dispatchEvent(new Event('toggle'));
  await tick();
};
afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('loads fresh state when an initially inactive native pane is first opened', async () => {
  const load = vi.fn(async () => ({
    success: true,
    data: [
      {
        displayName: 'Main',
        outbounds: [{ displayName: 'Fresh', selected: true, latency: 0 }],
      },
    ],
  }));
  const pane = document.createElement('div');
  pane.dataset.tabActive = 'false';
  const panel = renderNextPanel(undefined, load);
  pane.append(panel);
  document.body.append(pane);
  await settle();
  pane.dataset.tabActive = 'true';
  await settle();
  await tick();
  expect(panel.textContent).toContain('Main: Fresh');
});
it('refreshes selected servers after a native LuCI pane becomes active again', async () => {
  const stop = vi.fn();
  let name = 'before';
  const load = vi.fn(async () => ({
    success: true,
    data: [
      {
        displayName: 'Main',
        outbounds: [{ displayName: name, selected: true, latency: 0 }],
      },
    ],
  }));
  const pane = document.createElement('div');
  pane.dataset.tabActive = 'true';
  const panel = renderNextPanel(undefined, load, {
    subscribeRuntime: () => stop,
  });
  pane.append(panel);
  document.body.append(pane);
  await settle();
  await tick();
  pane.dataset.tabActive = 'false';
  await settle();
  expect(stop).toHaveBeenCalledOnce();
  name = 'after';
  pane.dataset.tabActive = 'true';
  await settle();
  await tick();
  expect(panel.textContent).toContain('Main: after');
});
it('uses fresh profiles and routes when lazy export tools are opened after a save and refresh', async () => {
  let saved = false;
  const panel = renderNextPanel(async (action) => {
    if (action === 'profile_save') {
      saved = true;
      return { success: true };
    }
    if (action === 'profile_list')
      return {
        success: true,
        data: {
          items: [{ name: 'home' }, ...(saved ? [{ name: 'new' }] : [])],
        },
      };
    if (action === 'status')
      return {
        success: true,
        data: {
          versions: {},
          sections: [
            {
              name: saved ? 'newroute' : 'oldroute',
              label: saved ? 'New route' : 'Old route',
            },
          ],
        },
      };
    return { success: true, data: { items: [] } };
  });
  document.body.append(panel);
  await open(panel, 'Расширенные настройки и диагностика');
  await open(panel, 'Профили и восстановление');
  (panel.querySelector('[name=profile_name]') as HTMLInputElement).value =
    'new';
  button(panel, 'Сохранить текущий профиль').click();
  await tick();
  button(panel, 'Обновить данные').click();
  await tick();
  await open(panel, 'Устройства, игровые пресеты и обмен профилями');
  expect(
    panel.querySelector('[aria-label="Профиль для экспорта"]')?.textContent,
  ).toContain('new');
  expect(
    panel.querySelector('[aria-label="Маршрут устройства"]')?.textContent,
  ).toContain('New route');
});
it('uses real service action adapter with pending feedback, no duplicate action and actual errors', async () => {
  let finish!: (r: { success: boolean; error?: string }) => void;
  const changeService = vi.fn(
    () =>
      new Promise<{ success: boolean; error?: string }>((resolve) => {
        finish = resolve;
      }),
  );
  const panel = renderNextPanel(undefined, undefined, {
    readRuntime: async () => ({ running: false }),
    changeService,
  });
  document.body.append(panel);
  await tick();
  const start = button(panel, 'Включить сервис');
  expect(start).toBeDefined();
  start.click();
  start.click();
  expect(changeService).toHaveBeenCalledExactlyOnceWith('start');
  expect(start.disabled).toBe(true);
  expect(panel.textContent).toContain('Выполняется действие сервиса');
  finish({ success: false, error: 'job failed' });
  await tick();
  expect(panel.textContent).toContain('job failed');
  expect(start.disabled).toBe(false);
});
it('blocks service controls during shared runtime actions and offers stop for a running service', async () => {
  let update!: (s: { running: boolean; pending?: boolean }) => void;
  const changeService = vi.fn(async () => ({ success: true }));
  const panel = renderNextPanel(undefined, undefined, {
    readRuntime: async () => ({ running: true }),
    subscribeRuntime: (l) => {
      update = l;
      return () => {};
    },
    changeService,
  });
  document.body.append(panel);
  await settle();
  await tick();
  expect(button(panel, 'Отключить сервис').disabled).toBe(false);
  update({ running: true, pending: true });
  expect(button(panel, 'Отключить сервис').disabled).toBe(true);
});
it('requires a domain before probing and offers native rule setup for a missing server', async () => {
  const request = vi.fn(async () => ({ success: true }));
  const openRules = vi.fn();
  const panel = renderNextPanel(
    request,
    async () => ({ success: true, data: [] }),
    { openRules },
  );
  document.body.append(panel);
  await tick();
  button(panel, 'Проверить соединение').click();
  await tick();
  expect(request).not.toHaveBeenCalled();
  expect(panel.textContent).toContain('Введите домен');
  expect(button(panel, 'Добавить подключение')).toBeDefined();
  button(panel, 'Добавить подключение').click();
  await tick();
  expect(openRules).toHaveBeenCalledOnce();
});
it('shows honest traffic totals then rates from two monotonic samples, resets after counter rollback', async () => {
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  let snapshot = { downloadTotal: 1000, uploadTotal: 500, connections: 2 };
  const readTraffic = vi.fn(async () => snapshot);
  const panel = renderNextPanel(undefined, undefined, { readTraffic });
  document.body.append(panel);
  await settle();
  await tick();
  expect(
    panel.querySelector('[data-metric="download-total"]')?.textContent,
  ).toBe('1\u00a0000 Б');
  expect(panel.querySelector('[data-metric="connections"]')?.textContent).toBe(
    '2',
  );
  expect(panel.textContent).toContain('Скорость ещё не измерена');
  vi.useFakeTimers();
  vi.spyOn(performance, 'now').mockReturnValue(4000);
  snapshot = { downloadTotal: 4000, uploadTotal: 2000, connections: 3 };
  button(panel, 'Обновить данные').click();
  await tick();
  expect(panel.textContent).toContain('Б/с');
  expect(
    panel.querySelector('[data-metric="download-rate"]')?.textContent,
  ).toBe('1\u00a0000 Б/с');
  expect(panel.querySelector('[data-metric="upload-rate"]')?.textContent).toBe(
    '500 Б/с',
  );
  vi.spyOn(performance, 'now').mockReturnValue(7000);
  snapshot = { downloadTotal: 5, uploadTotal: 1, connections: 0 };
  button(panel, 'Обновить данные').click();
  await tick();
  expect(panel.textContent).toContain('Скорость ещё не измерена');
});
it('polls traffic without overlap and stops while hidden or removed', async () => {
  vi.useFakeTimers();
  let finish!: (s: {
    downloadTotal: number;
    uploadTotal: number;
    connections: number;
  }) => void;
  const readTraffic = vi.fn(
    () =>
      new Promise<{
        downloadTotal: number;
        uploadTotal: number;
        connections: number;
      }>((resolve) => {
        finish = resolve;
      }),
  );
  const pane = document.createElement('div');
  pane.dataset.tabActive = 'true';
  const panel = renderNextPanel(undefined, undefined, { readTraffic });
  pane.append(panel);
  document.body.append(pane);
  await vi.advanceTimersByTimeAsync(0);
  expect(readTraffic).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(9000);
  expect(readTraffic).toHaveBeenCalledOnce();
  pane.dataset.tabActive = 'false';
  await vi.advanceTimersByTimeAsync(0);
  finish({ downloadTotal: 10, uploadTotal: 10, connections: 1 });
  await tick();
  await vi.advanceTimersByTimeAsync(9000);
  expect(readTraffic).toHaveBeenCalledOnce();
  expect(panel.textContent).not.toContain('Получено: 10');
  pane.dataset.tabActive = 'true';
  await vi.advanceTimersByTimeAsync(0);
  expect(readTraffic).toHaveBeenCalledTimes(2);
  panel.remove();
  await vi.advanceTimersByTimeAsync(0);
  finish({ downloadTotal: 20, uploadTotal: 20, connections: 2 });
  await tick();
  await vi.advanceTimersByTimeAsync(9000);
  expect(readTraffic).toHaveBeenCalledTimes(2);
});
