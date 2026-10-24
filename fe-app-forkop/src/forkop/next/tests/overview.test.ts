// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { renderNextPanel } from '../render';
const tick = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
const button = (panel: HTMLElement, text: string) =>
  [...panel.querySelectorAll('button')].find((b) => b.textContent === text)!;
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it('renders connection actions immediately and defers every advanced read until expanded', async () => {
  const request = vi.fn(async () => ({ success: true, data: { items: [] } }));
  const panel = renderNextPanel(request);
  document.body.append(panel);
  await tick();
  expect(panel.textContent).toContain('Состояние сервиса неизвестно');
  expect(button(panel, 'Проверить соединение')).toBeDefined();
  expect(button(panel, 'Изменить сервер')).toBeDefined();
  expect(panel.textContent).toContain('Трафик пока недоступен');
  expect(request).not.toHaveBeenCalled();
  const details = panel.querySelector('details')!;
  details.open = true;
  details.dispatchEvent(new Event('toggle'));
  await tick();
  expect(panel.textContent).toContain('Профили и восстановление');
  expect(request.mock.calls.length).toBeGreaterThan(0);
});
it('does not claim connectivity from a running service and shows explicit probe result and time', async () => {
  const request = vi.fn(async () => ({
    success: true,
    data: {
      reachable: false,
      checked_at: 1792752000,
      duration_ms: 25,
      http_status: 503,
    },
  }));
  const panel = renderNextPanel(request, undefined, {
    readRuntime: async () => ({ running: true }),
  });
  document.body.append(panel);
  await tick();
  expect(panel.textContent).toContain('Сервис запущен');
  expect(panel.textContent).toContain('Соединение ещё не проверено');
  expect(request).not.toHaveBeenCalled();
  (panel.querySelector('[name=connection_domain]') as HTMLInputElement).value =
    'example.org';
  button(panel, 'Проверить соединение').click();
  await tick();
  expect(request).toHaveBeenCalledWith('probe', { domain: 'example.org' });
  expect(panel.textContent).toContain('Нет сетевого ответа');
  expect(panel.textContent).toContain('25 мс');
  expect(panel.textContent).toContain(
    new Date(1792752000 * 1000).toLocaleString(),
  );
});
it('leaves missing probe evidence unknown and handles failed runtime reads', async () => {
  const panel = renderNextPanel(
    async () => ({ success: true, data: {} }),
    undefined,
    {
      readRuntime: async () => {
        throw Error('offline');
      },
    },
  );
  document.body.append(panel);
  await tick();
  expect(panel.textContent).toContain('Состояние сервиса недоступно');
  (panel.querySelector('[name=connection_domain]') as HTMLInputElement).value =
    'example.org';
  button(panel, 'Проверить соединение').click();
  await tick();
  expect(panel.textContent).toContain('Результат проверки неизвестен');
  expect(panel.textContent).not.toContain('Соединение работает');
});
it('uses an explicit server navigation adapter and shows its failure', async () => {
  const openServers = vi.fn(async () => {
    throw Error('unavailable');
  });
  const panel = renderNextPanel(undefined, undefined, { openServers });
  document.body.append(panel);
  button(panel, 'Изменить сервер').click();
  await tick();
  expect(openServers).toHaveBeenCalledOnce();
  expect(panel.textContent).toContain('Не удалось открыть выбор сервера');
});
it('loads each advanced area only on first open and preserves profile review safeguards', async () => {
  const calls: string[] = [];
  const panel = renderNextPanel(async (action) => {
    calls.push(action);
    return {
      success: true,
      data:
        action === 'status'
          ? { sections: [], versions: {} }
          : { items: [{ name: 'home' }] },
    };
  });
  document.body.append(panel);
  const outer = panel.querySelector('details')!;
  outer.open = true;
  outer.dispatchEvent(new Event('toggle'));
  await tick();
  expect(calls).toEqual(['status']);
  expect(panel.querySelector('[name=profile_name]')).toBeNull();
  const profiles = [...panel.querySelectorAll('details')].find(
    (d) =>
      d.querySelector('summary')?.textContent === 'Профили и восстановление',
  )!;
  profiles.open = true;
  profiles.dispatchEvent(new Event('toggle'));
  await tick();
  expect(calls).toEqual(['status', 'profile_list']);
  expect(button(panel, 'Применить профиль').disabled).toBe(true);
  profiles.open = false;
  profiles.dispatchEvent(new Event('toggle'));
  profiles.open = true;
  profiles.dispatchEvent(new Event('toggle'));
  await tick();
  expect(calls.filter((a) => a === 'profile_list')).toHaveLength(1);
});
it('does not let a slow initial runtime reply overwrite a newer shared update', async () => {
  let finish!: (s: { running: boolean }) => void;
  let update!: (s: { running: boolean }) => void;
  const panel = renderNextPanel(undefined, undefined, {
    readRuntime: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    subscribeRuntime: (listener) => {
      update = listener;
      return () => {};
    },
  });
  document.body.append(panel);
  await new Promise((r) => setTimeout(r, 0));
  update({ running: false });
  finish({ running: true });
  await tick();
  expect(panel.textContent).toContain('Сервис остановлен');
});
it('unsubscribes when hidden or removed and ignores a late refresh', async () => {
  let finish!: (s: { running: boolean }) => void;
  const unsubscribe = vi.fn();
  const panel = renderNextPanel(undefined, undefined, {
    readRuntime: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    subscribeRuntime: () => unsubscribe,
  });
  document.body.append(panel);
  await new Promise((r) => setTimeout(r, 0));
  panel.hidden = true;
  await new Promise((r) => setTimeout(r, 0));
  expect(unsubscribe).toHaveBeenCalledOnce();
  finish({ running: true });
  await tick();
  expect(panel.textContent).toContain('Состояние сервиса неизвестно');
});
it('shows the main runtime state while advanced status remains unresolved', async () => {
  const panel = renderNextPanel(() => new Promise(() => {}), undefined, {
    readRuntime: async () => ({ running: true }),
  });
  document.body.append(panel);
  const advanced = panel.querySelector('details')!;
  advanced.open = true;
  advanced.dispatchEvent(new Event('toggle'));
  await tick();
  expect(panel.querySelector('.fkp-next-service')?.textContent).toBe(
    'Сервис запущен',
  );
});
it('uses the native Dashboard tab when no selection adapter is supplied', async () => {
  const menu = document.createElement('ul');
  menu.className = 'cbi-tabmenu';
  const item = document.createElement('li');
  item.dataset.tab = 'dashboard';
  const link = document.createElement('a');
  const click = vi.fn();
  link.onclick = click;
  item.append(link);
  menu.append(item);
  document.body.append(menu);
  const panel = renderNextPanel();
  document.body.append(panel);
  button(panel, 'Изменить сервер').click();
  await tick();
  expect(click).toHaveBeenCalledOnce();
});
it('pauses the runtime subscription while the document is hidden', async () => {
  const stop = vi.fn();
  const panel = renderNextPanel(undefined, undefined, {
    subscribeRuntime: () => stop,
  });
  document.body.append(panel);
  await new Promise((r) => setTimeout(r, 0));
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
  expect(stop).toHaveBeenCalledOnce();
});
