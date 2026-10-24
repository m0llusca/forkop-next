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
  workspace?: boolean;
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
  const header = el('div', '', 'fkp-next-heading');
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
  if (!adapters.workspace) header.append(title, theme);
  else root.dataset.workspace = 'true';
  root.append(header);
  const service = el('p', 'Состояние сервиса неизвестно', 'fkp-next-service');
  service.setAttribute('role', 'status');
  const connection = el(
    'p',
    'Соединение ещё не проверено',
    'fkp-next-connection',
  );
  connection.setAttribute('role', 'status');
  connection.dataset.state = 'unknown';
  const notice = el('p', '', 'fkp-next-notice');
  notice.setAttribute('role', 'status');
  const status = el('section', '', 'fkp-next-status-block');
  status.append(el('h3', 'Доступ в сеть'), service, connection, notice);
  let probeRevision = 0;
  let hasProbe = false;
  function invalidateProbe() {
    probeRevision++;
    if (!hasProbe) return;
    connection.dataset.state = 'unknown';
    connection.textContent =
      'Маршрут или состояние сервиса изменились. Повторите проверку соединения.';
  }
  let runtime: OverviewRuntime | undefined;
  let servicePending = false;
  const serviceControl = el('button', 'Включить сервис');
  serviceControl.type = 'button';
  serviceControl.disabled = true;
  if (adapters.changeService) status.append(serviceControl);
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
    invalidateProbe();
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
  const server = el('section', '', 'fkp-next-primary');
  const selected = el(
    'div',
    loadConnections
      ? 'Загружаем выбранный сервер…'
      : 'Выбранный сервер неизвестен',
    'fkp-next-summary',
  );
  const serverHeading = el('h3', 'Основное подключение');
  server.append(
    serverHeading,
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
  const setupHelp = el(
    'p',
    'Первое подключение добавляется в правилах маршрутизации. Выберите сервер и сохраните настройки.',
    'fkp-next-help',
  );
  server.append(addConnection, setupHelp);
  const check = el('div', '', 'fkp-next-probe');
  const domainLabel = el('label', 'Сайт для проверки');
  const domain = el('input');
  domain.name = 'connection_domain';
  domain.placeholder = 'example.org';
  domain.autocomplete = 'off';
  domain.setAttribute('aria-label', 'Сайт для проверки');
  domainLabel.append(domain);
  check.append(domainLabel);
  const probeButton = action('Проверить соединение', async () => {
    if (!visible()) return;
    const target = domain.value.trim();
    if (!target || /[/:]/.test(target) || !validateDomain(target).valid) {
      domain.setAttribute('aria-invalid', 'true');
      connection.dataset.state = 'error';
      connection.textContent =
        'Введите домен сайта, например example.org, без https:// и пути.';
      domain.focus();
      return;
    }
    domain.removeAttribute('aria-invalid');
    hasProbe = true;
    const revision = ++probeRevision;
    const current = () => revision === probeRevision && visible();
    connection.dataset.state = 'pending';
    connection.textContent = `Проверяем ${target} с роутера…`;
    try {
      const response = await request('probe', {
        domain: target,
      });
      if (!current()) return;
      if (!response.success) {
        connection.dataset.state = 'error';
        connection.textContent = `${target}: проверка не выполнена: ${response.error || 'нет связи с роутером'}. Повторите проверку.`;
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
      connection.dataset.state =
        data.reachable === true
          ? 'reachable'
          : data.reachable === false
            ? 'unreachable'
            : 'unknown';
      const checked =
        typeof data.checked_at === 'number'
          ? new Date(data.checked_at * 1000).toLocaleString()
          : 'время не сообщено';
      connection.textContent = `${target}: ${result} · HTTP ${data.http_status || '—'} · ${typeof data.duration_ms === 'number' ? `${data.duration_ms} мс` : 'длительность неизвестна'} · ${checked}. Проверен доступ с роутера; вход в сервис не проверяется.`;
    } catch {
      if (!current()) return;
      connection.dataset.state = 'error';
      connection.textContent = `${target}: проверка не выполнена: нет связи с роутером. Повторите проверку.`;
    }
  });
  probeButton.className = 'fkp-next-primary-action';
  check.append(
    probeButton,
    el(
      'p',
      'Проверка использует текущий маршрут роутера. Состояние процесса и прежняя задержка не подтверждают доступность сайта.',
      'fkp-next-help',
    ),
  );
  status.append(check);
  const everyday = el('div', '', 'fkp-next-content');
  everyday.append(status, server);
  root.append(everyday);
  const traffic = el('section', '', 'fkp-next-panel fkp-next-traffic');
  const trafficOutput = el('div');
  traffic.append(el('h3', 'Трафик'), trafficOutput);
  root.append(traffic);
  const routes = el('section', '', 'fkp-next-panel fkp-next-routes');
  routes.append(el('h3', 'Дополнительные маршруты'));
  const routesOutput = el('div', 'Данные маршрутов пока недоступны.');
  routes.append(
    routesOutput,
    action('Открыть правила', async () => {
      try {
        if (adapters.openRules) await adapters.openRules();
        else {
          const tab = document.querySelector<HTMLElement>(
            '.cbi-tabmenu [data-tab="section"] a, .cbi-tabmenu [data-tab="section"] button',
          );
          if (!tab) throw Error('navigation_unavailable');
          tab.click();
        }
      } catch {
        notice.textContent =
          'Не удалось открыть правила. Откройте вкладку «Правила» в LuCI.';
      }
    }),
  );
  root.append(routes);
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
  if (!adapters.workspace) root.append(advanced);
  let generation = 0;
  let runtimeRevision = 0;
  let hasFreshRuntime = false;
  let subscribed = false;
  let resumeRefresh = false;
  let unsubscribe: (() => void) | undefined;
  let selectedSignature: string | undefined;
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
    if (
      state?.running !== runtime?.running ||
      Boolean(state?.pending) !== Boolean(runtime?.pending) ||
      state?.error !== runtime?.error
    )
      invalidateProbe();
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
              invalidateProbe();
              selected.textContent =
                'Выбранный сервер недоступен. Обновите данные.';
              routesOutput.textContent =
                'Маршруты недоступны. Обновите данные.';
              return;
            }
            const groups = response.data || [];
            const signature = JSON.stringify(
              groups
                .map((group) => [
                  group.sectionName || group.code || group.displayName,
                  group.outbounds
                    .filter((o) => o.selected)
                    .map((o) => o.code || o.displayName),
                ])
                .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
            );
            if (signature !== selectedSignature) invalidateProbe();
            selectedSignature = signature;
            const primary =
              groups.find((g) => g.sectionName === 'main') || groups[0];
            serverHeading.textContent =
              primary && primary.sectionName !== 'main'
                ? 'Первое подключение'
                : 'Основное подключение';
            selected.replaceChildren();
            routesOutput.replaceChildren();
            for (const group of groups) {
              const outbound = group.outbounds.find((o) => o.selected);
              const host = group === primary ? selected : routesOutput;
              const row = el('div', '', 'fkp-next-route');
              row.append(
                el(
                  'p',
                  `${group.displayName}: ${outbound?.displayName || 'сервер не выбран'}`,
                  group === primary ? 'fkp-next-selected-name' : '',
                ),
              );
              if (outbound)
                row.append(
                  el(
                    'p',
                    `${outbound.latency > 0 ? `Прежняя задержка ${outbound.latency} мс` : 'Задержка не измерена'}${outbound.latencyTestedAt ? ` · ${new Date(outbound.latencyTestedAt).toLocaleString()}` : ''}`,
                    'fkp-next-help',
                  ),
                );
              host.append(row);
            }
            const primarySelected = primary?.outbounds.some((o) => o.selected);
            addConnection.hidden = Boolean(primarySelected);
            setupHelp.hidden = Boolean(primarySelected);
            if (!routesOutput.childNodes.length)
              routesOutput.textContent =
                'Дополнительных маршрутов нет. Они появятся после настройки правил.';
            if (!selected.childNodes.length)
              selected.textContent =
                'Выбранного сервера нет. Настройте подключение на вкладке Dashboard.';
          } catch {
            if (alive()) {
              invalidateProbe();
              selected.textContent =
                'Не удалось загрузить выбранный сервер. Обновите данные.';
              routesOutput.textContent =
                'Не удалось загрузить маршруты. Обновите данные.';
            }
          }
        })(),
      );
    await Promise.all(tasks);
  }
  header.append(action('Обновить данные', refresh));
  function configurationChanged() {
    invalidateProbe();
    generation++;
    selectedSignature = undefined;
    telemetry.stop();
    if (visible()) void refresh();
    else resumeRefresh = true;
  }
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
      invalidateProbe();
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
      window.removeEventListener(
        'forkop:configuration-changed',
        configurationChanged,
      );
    }
  }
  const observer = new MutationObserver(updateVisibility);
  document.addEventListener('visibilitychange', updateVisibility);
  window.addEventListener('forkop:configuration-changed', configurationChanged);
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
