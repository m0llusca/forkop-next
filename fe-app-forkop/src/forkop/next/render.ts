import { nextRequest } from './api';
import { validateDomain } from '../../validators/validateDomain';
import { createTrafficMonitor, type OverviewTraffic } from './traffic';
import {
  renderAdvancedPanel,
  type Request,
  type ConnectionLoader,
} from './advanced';

export interface OverviewRuntime {
  running?: boolean;
  pending?: boolean;
  error?: string;
}
export interface OverviewAdapters {
  readRuntime?: () => Promise<OverviewRuntime | undefined>;
  subscribeRuntime?: (
    listener: (state: OverviewRuntime, evidence?: { cached?: boolean }) => void,
  ) => () => void;
  openServers?: () => void | Promise<void>;
  openRules?: () => void | Promise<void>;
  changeService?: (
    action: 'start' | 'stop',
  ) => Promise<{ success: boolean; error?: string }>;
  readTraffic?: () => Promise<OverviewTraffic | undefined>;
}
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = '',
  className = '',
) {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}
export function renderNextPanel(
  request: Request = nextRequest,
  loadConnections?: ConnectionLoader,
  adapters: OverviewAdapters = {},
): HTMLElement {
  const root = el('section', '', 'fkp-next fkp-next-overview');
  root.dataset.mode = 'simple';
  const header = el('header');
  const title = el('div');
  title.append(
    el('h2', 'Подключение'),
    el('p', 'Состояние роутера и проверка доступа в сеть.'),
  );
  const theme = el('label', 'Тема');
  const themes = el('select');
  for (const [value, label] of [
    ['auto', 'Как в LuCI'],
    ['light', 'Светлая'],
    ['dark', 'Тёмная'],
  ]) {
    const option = el('option', label);
    option.value = value;
    themes.append(option);
  }
  themes.onchange = () => {
    root.dataset.theme = themes.value;
  };
  theme.append(themes);
  header.append(title, theme);
  root.append(header);
  const service = el('p', 'Состояние сервиса неизвестно', 'fkp-next-service');
  service.setAttribute('role', 'status');
  const connection = el(
    'p',
    'Соединение ещё не проверено',
    'fkp-next-connection',
  );
  connection.setAttribute('role', 'status');
  const notice = el('p', '', 'fkp-next-notice');
  notice.setAttribute('role', 'status');
  root.append(service, connection, notice);
  let runtime: OverviewRuntime | undefined;
  let servicePending = false;
  const serviceControl = el('button', 'Включить сервис');
  serviceControl.type = 'button';
  serviceControl.disabled = true;
  if (adapters.changeService) root.insertBefore(serviceControl, connection);
  function updateServiceControl() {
    serviceControl.textContent =
      runtime?.running === true ? 'Отключить сервис' : 'Включить сервис';
    serviceControl.disabled =
      servicePending ||
      runtime?.pending === true ||
      typeof runtime?.running !== 'boolean' ||
      Boolean(runtime?.error);
    serviceControl.setAttribute(
      'aria-busy',
      String(servicePending || runtime?.pending === true),
    );
  }
  serviceControl.onclick = async () => {
    if (serviceControl.disabled || !adapters.changeService) return;
    servicePending = true;
    updateServiceControl();
    service.textContent = 'Выполняется действие сервиса…';
    notice.textContent = '';
    try {
      const result = await adapters.changeService(
        runtime?.running === true ? 'stop' : 'start',
      );
      if (!result.success)
        notice.textContent = `Не удалось изменить состояние сервиса: ${result.error || 'неизвестная ошибка'}`;
      else notice.textContent = 'Действие сервиса завершено.';
    } catch (error) {
      notice.textContent = `Не удалось изменить состояние сервиса: ${error instanceof Error ? error.message : 'нет связи с роутером'}`;
    } finally {
      try {
        await refresh();
      } finally {
        servicePending = false;
        applyRuntime(runtime);
      }
    }
  };
  function action(text: string, run: () => Promise<void>) {
    const b = el('button', text);
    b.type = 'button';
    b.onclick = async () => {
      if (b.disabled) return;
      b.disabled = true;
      b.setAttribute('aria-busy', 'true');
      try {
        await run();
      } finally {
        b.disabled = false;
        b.setAttribute('aria-busy', 'false');
      }
    };
    return b;
  }
  const server = el('section', '', 'fkp-next-panel');
  const selected = el(
    'div',
    loadConnections
      ? 'Загружаем выбранный сервер…'
      : 'Выбранный сервер неизвестен',
    'fkp-next-summary',
  );
  server.append(
    el('h3', 'Выбранный сервер'),
    selected,
    action('Изменить сервер', async () => {
      notice.textContent = 'Открываем выбор сервера…';
      try {
        if (adapters.openServers) await adapters.openServers();
        else {
          const tab = document.querySelector<HTMLElement>(
            '.cbi-tabmenu [data-tab="dashboard"] a, .cbi-tabmenu [data-tab="dashboard"] button',
          );
          if (!tab) throw new Error('navigation_unavailable');
          tab.click();
        }
        notice.textContent = '';
      } catch {
        notice.textContent =
          'Не удалось открыть выбор сервера. Откройте вкладку Dashboard в LuCI.';
      }
    }),
  );
  const addConnection = action('Добавить подключение', async () => {
    notice.textContent = 'Открываем настройки подключения…';
    try {
      if (adapters.openRules) await adapters.openRules();
      else {
        const tab = document.querySelector<HTMLElement>(
          '.cbi-tabmenu [data-tab="section"] a, .cbi-tabmenu [data-tab="section"] button',
        );
        if (!tab) throw new Error('navigation_unavailable');
        tab.click();
      }
      notice.textContent = '';
    } catch {
      notice.textContent =
        'Не удалось открыть настройки. Откройте вкладку «Правила» в LuCI.';
    }
  });
  server.append(
    addConnection,
    el(
      'p',
      'Первое подключение добавляется в правилах маршрутизации. Выберите сервер и сохраните настройки.',
      'fkp-next-help',
    ),
  );
  const check = el('section', '', 'fkp-next-panel');
  check.append(el('h3', 'Проверка соединения'));
  const domainLabel = el('label', 'Сайт для проверки');
  const domain = el('input');
  domain.name = 'connection_domain';
  domain.placeholder = 'example.org';
  domain.autocomplete = 'off';
  domainLabel.append(domain);
  check.append(domainLabel);
  check.append(
    action('Проверить соединение', async () => {
      const target = domain.value.trim();
      if (!target || /[/:]/.test(target) || !validateDomain(target).valid) {
        domain.setAttribute('aria-invalid', 'true');
        connection.textContent =
          'Введите домен сайта, например example.org, без https:// и пути.';
        domain.focus();
        return;
      }
      domain.removeAttribute('aria-invalid');
      connection.textContent = 'Проверяем сетевой доступ с роутера…';
      try {
        const response = await request('probe', {
          domain: target,
        });
        if (!response.success) {
          connection.textContent = `Проверка не выполнена: ${response.error || 'нет связи с роутером'}. Повторите проверку.`;
          return;
        }
        const data =
          response.data && typeof response.data === 'object'
            ? (response.data as Record<string, unknown>)
            : {};
        const result =
          data.reachable === true
            ? 'Есть сетевой ответ'
            : data.reachable === false
              ? 'Нет сетевого ответа'
              : 'Результат проверки неизвестен';
        const checked =
          typeof data.checked_at === 'number'
            ? new Date(data.checked_at * 1000).toLocaleString()
            : 'время не сообщено';
        connection.textContent = `${result} · HTTP ${data.http_status || '—'} · ${typeof data.duration_ms === 'number' ? `${data.duration_ms} мс` : 'длительность неизвестна'} · ${checked}. Проверен доступ с роутера; вход в сервис не проверяется.`;
      } catch {
        connection.textContent =
          'Проверка не выполнена: нет связи с роутером. Повторите проверку.';
      }
    }),
    el(
      'p',
      'Проверка использует текущий маршрут роутера. Состояние процесса и прежняя задержка не подтверждают доступность сайта.',
      'fkp-next-help',
    ),
  );
  const everyday = el('div', '', 'fkp-next-content');
  everyday.append(server, check);
  root.append(everyday);
  const traffic = el('section', '', 'fkp-next-panel fkp-next-traffic');
  const trafficOutput = el('p', 'Трафик пока недоступен.');
  trafficOutput.setAttribute('role', 'status');
  traffic.append(el('h3', 'Трафик'), trafficOutput);
  root.append(traffic);
  const advanced = el('details', '', 'fkp-next-advanced');
  advanced.append(el('summary', 'Расширенные настройки и диагностика'));
  let mounted = false;
  let advancedPanel: HTMLElement | undefined;
  advanced.addEventListener('toggle', () => {
    root.dataset.mode = advanced.open ? 'detailed' : 'simple';
    if (advanced.open && !mounted) {
      mounted = true;
      advancedPanel = renderAdvancedPanel(request, undefined, true);
      advanced.append(advancedPanel);
    }
  });
  root.append(advanced);
  let generation = 0;
  let runtimeRevision = 0;
  let hasFreshRuntime = false;
  let subscribed = false;
  let resumeRefresh = false;
  let unsubscribe: (() => void) | undefined;
  const visible = () =>
    root.isConnected &&
    document.visibilityState !== 'hidden' &&
    !root.closest(
      '[hidden], [data-tab-active="false"], [style*="display: none"], [style*="display:none"]',
    );
  const telemetry = createTrafficMonitor(
    trafficOutput,
    adapters.readTraffic,
    visible,
  );
  function applyRuntime(
    state: OverviewRuntime | undefined,
    evidence?: { cached?: boolean },
  ) {
    if (evidence?.cached && hasFreshRuntime) return;
    if (!evidence?.cached) hasFreshRuntime = true;
    runtime = state;
    updateServiceControl();
    service.textContent =
      state?.pending || servicePending
        ? 'Выполняется действие сервиса…'
        : state?.error
          ? 'Состояние сервиса недоступно. Обновите данные.'
          : state?.running === true
            ? 'Сервис запущен'
            : state?.running === false
              ? 'Сервис остановлен'
              : 'Состояние сервиса неизвестно';
  }
  async function refresh(refreshAdvanced = true) {
    void telemetry.refresh();
    if (refreshAdvanced && advanced.open)
      advancedPanel?.dispatchEvent(new Event('forkop:refresh'));
    const current = ++generation;
    const alive = () => current === generation && visible();
    const tasks: Promise<void>[] = [];
    const revision = runtimeRevision;
    if (adapters.readRuntime)
      tasks.push(
        (async () => {
          try {
            const state = await adapters.readRuntime!();
            if (alive() && revision === runtimeRevision) applyRuntime(state);
          } catch {
            if (alive() && revision === runtimeRevision)
              applyRuntime({ error: 'unavailable' });
          }
        })(),
      );
    if (loadConnections)
      tasks.push(
        (async () => {
          try {
            const response = await loadConnections();
            if (!alive()) return;
            if (!response.success) {
              selected.textContent =
                'Выбранный сервер недоступен. Обновите данные.';
              return;
            }
            selected.replaceChildren();
            for (const group of response.data || []) {
              const outbound = group.outbounds.find((o) => o.selected);
              if (outbound)
                selected.append(
                  el(
                    'p',
                    `${group.displayName}: ${outbound.displayName}${outbound.latency > 0 ? ` · прежняя задержка ${outbound.latency} мс` : ' · задержка не измерена'}${outbound.latencyTestedAt ? ` · ${new Date(outbound.latencyTestedAt).toLocaleString()}` : ''}`,
                  ),
                );
            }
            if (!selected.childNodes.length)
              selected.textContent =
                'Выбранного сервера нет. Настройте подключение на вкладке Dashboard.';
          } catch {
            if (alive())
              selected.textContent =
                'Не удалось загрузить выбранный сервер. Обновите данные.';
          }
        })(),
      );
    await Promise.all(tasks);
  }
  header.append(action('Обновить данные', refresh));
  // Shared runtime updates avoid starting another periodic poll for this view.
  function updateVisibility() {
    if (visible() && !subscribed) {
      subscribed = true;
      unsubscribe = adapters.subscribeRuntime?.((state, evidence) => {
        if (visible()) {
          if (!evidence?.cached) runtimeRevision++;
          applyRuntime(state, evidence);
        }
      });
      if (resumeRefresh) {
        resumeRefresh = false;
        void refresh();
      } else void telemetry.refresh();
    } else if (!visible() && subscribed) {
      subscribed = false;
      unsubscribe?.();
      unsubscribe = undefined;
      generation++;
      telemetry.stop();
      resumeRefresh = true;
    }
    if (!root.isConnected) {
      telemetry.stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
    }
  }
  const observer = new MutationObserver(updateVisibility);
  document.addEventListener('visibilitychange', updateVisibility);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['hidden', 'style', 'class', 'data-tab-active'],
  });
  queueMicrotask(() => {
    if (visible()) void refresh(false);
    else resumeRefresh = true;
  });
  return root;
}
