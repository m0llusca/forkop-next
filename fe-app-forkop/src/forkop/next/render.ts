import { navigateToRule } from './workflows';
import { nextRequest } from './api';
import { validateDomain } from '../../validators/validateDomain';
import { createTrafficMonitor, type OverviewTraffic } from './traffic';
import {
  renderAdvancedPanel,
  type Request,
  type ConnectionLoader,
} from './advanced';
import {
  actionMenuDivider,
  createActionMenu,
  decorateActionMenuItems,
} from '../workspace/actionMenu';

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
  if (!adapters.workspace) header.append(title);
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
  status.append(service, connection, notice);
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
  const heroActions = el('div', '', 'fkp-next-hero-actions');
  const heroOverflow = createActionMenu('Ещё', [], {
    ariaLabel: 'Дополнительные действия',
  });
  const heroOverflowPopover = heroOverflow.querySelector<HTMLElement>(
    '.fkp-action-menu__popover',
  )!;
  const heroOverflowDivider = actionMenuDivider();
  const heroRefs: { add?: HTMLButtonElement; refresh?: HTMLButtonElement } = {};
  function syncServiceControlPlacement() {
    if (!adapters.changeService) {
      heroOverflow.hidden = !heroOverflowPopover.querySelector('button');
      return;
    }
    if (runtime?.running === false) {
      serviceControl.classList.remove(
        'fkp-action-menu__item',
        'fkp-action-menu__danger',
      );
      serviceControl.removeAttribute('role');
      delete serviceControl.dataset.danger;
      heroOverflowDivider.remove();
      if (heroRefs.add && heroRefs.add.parentElement === heroActions) {
        heroActions.insertBefore(serviceControl, heroRefs.add);
      } else {
        heroActions.insertBefore(serviceControl, heroOverflow);
      }
    } else {
      if (runtime?.running === true) {
        serviceControl.dataset.danger = 'true';
      } else {
        delete serviceControl.dataset.danger;
        serviceControl.classList.remove('fkp-action-menu__danger');
      }
      if (heroRefs.refresh && heroOverflowPopover.contains(heroRefs.refresh)) {
        heroOverflowPopover.append(heroOverflowDivider, serviceControl);
      } else {
        heroOverflowDivider.remove();
        heroOverflowPopover.append(serviceControl);
      }
      decorateActionMenuItems(heroOverflowPopover);
      if (runtime?.running !== true) {
        serviceControl.classList.remove('fkp-action-menu__danger');
      }
    }
    heroOverflow.hidden = !heroOverflowPopover.querySelector('button');
  }
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
    syncServiceControlPlacement();
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
  const changeServer = action('Изменить сервер', async () => {
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
  });
  changeServer.className = 'fkp-next-primary-action';
  const addConnection = action('Добавить подключение', async () => {
    notice.textContent = 'Открываем настройки подключения…';
    try {
      if (adapters.openRules) await adapters.openRules();
      else if (
        !navigateToRule(root, { kind: 'create', option: 'subscription_url' })
      )
        throw new Error('navigation_unavailable');
      notice.textContent = '';
    } catch {
      notice.textContent =
        'Не удалось открыть настройки. Откройте вкладку «Правила» в LuCI.';
    }
  });
  heroRefs.add = addConnection;
  heroActions.append(changeServer, addConnection);
  if (adapters.workspace || adapters.changeService) {
    heroActions.append(heroOverflow);
  }
  const setupHelp = el(
    'p',
    'Добавьте ссылку или подписку, проверьте условия правила, сохраните и примените изменения. Затем вернитесь к выбору узла.',
    'fkp-next-help',
  );
  const check = el('details', '', 'fkp-next-probe');
  check.append(el('summary', 'Проверить соединение'));
  const domainLabel = el('label', 'Сайт для проверки');
  const domain = el('input');
  domain.name = 'connection_domain';
  domain.placeholder = 'example.org';
  domain.autocomplete = 'off';
  domain.setAttribute('aria-label', 'Сайт для проверки');
  domainLabel.append(domain);
  const probeButton = action('Проверить соединение', async () => {
    if (!visible()) return;
    const target = domain.value.trim();
    if (!target || /[/:]/.test(target) || !validateDomain(target).valid) {
      domain.setAttribute('aria-invalid', 'true');
      connection.dataset.state = 'error';
      connection.textContent =
        'Введите домен сайта, например example.org, без https:// и пути.';
      check.open = true;
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
  const probeForm = el('div', '', 'fkp-next-probe-form');
  probeForm.append(domainLabel, probeButton);
  check.append(
    probeForm,
    el(
      'p',
      'Проверка использует текущий маршрут роутера. Состояние процесса и прежняя задержка не подтверждают доступность сайта.',
      'fkp-next-help',
    ),
  );
  server.append(serverHeading, selected, heroActions, setupHelp, check);
  let primarySectionName: string | undefined;
  function activateMapTab(tabName: string): HTMLElement | null {
    const scope = root.closest('.cbi-map') || document;
    const tab = scope.querySelector<HTMLElement>(
      `.cbi-tabmenu [data-tab="${tabName}"] a, .cbi-tabmenu [data-tab="${tabName}"] button`,
    );
    if (!tab) return null;
    tab.click();
    return (
      [
        ...scope.querySelectorAll<HTMLElement>('.cbi-map-tabbed > [data-tab]'),
      ].find((node) => node.dataset.tab === tabName) || null
    );
  }
  function createScenarioCard(
    id: string,
    heading: string,
    subtitle: string,
    onSelect: () => void | Promise<void>,
  ): HTMLButtonElement {
    const card = el('button', '', 'fkp-scenario-card');
    card.type = 'button';
    card.dataset.scenario = id;
    card.append(
      el('strong', heading, 'fkp-scenario-title'),
      el('span', subtitle, 'fkp-scenario-desc'),
    );
    card.onclick = () => {
      void onSelect();
    };
    return card;
  }
  const scenarios = el('section', '', 'fkp-next-panel fkp-next-scenarios');
  scenarios.append(el('h3', 'Быстрые сценарии'));
  const scenarioGrid = el('div', '', 'fkp-scenario-grid');
  scenarioGrid.append(
    createScenarioCard(
      'vpn-warp',
      'WireGuard, AmneziaWG или WARP',
      'Импорт .conf или выпуск бесплатного профиля Cloudflare WARP в 1 клик.',
      async () => {
        const destination = primarySectionName
          ? ({
              kind: 'edit',
              section: primarySectionName,
              option: '_wg_warp_helper',
            } as const)
          : ({ kind: 'create', option: '_wg_warp_helper' } as const);
        if (navigateToRule(root, destination)) {
          notice.textContent = '';
          return;
        }
        if (adapters.openRules) {
          await adapters.openRules();
          notice.textContent = '';
          return;
        }
        notice.textContent =
          'Откройте раздел «Правила», чтобы импортировать .conf или выпустить профиль WARP.';
      },
    ),
    createScenarioCard(
      'gaming-nat',
      'Игры и консоли (Open NAT)',
      'PlayStation, Xbox и ПК: обход блокировок для входа и прямой UDP без потери пинга.',
      () => {
        const pane = activateMapTab('devices');
        if (pane) {
          const gamingInput = pane.querySelector<HTMLElement>(
            '[aria-label="Игровое устройство"], input',
          );
          gamingInput?.focus();
          gamingInput?.scrollIntoView?.({ block: 'center' });
          notice.textContent = '';
          return;
        }
        if (!adapters.workspace) {
          advanced.open = true;
          advanced.dispatchEvent(new Event('toggle'));
          const gamingSummary = [
            ...advanced.querySelectorAll<HTMLElement>('summary'),
          ].find((s) => s.textContent?.includes('Устройства'));
          if (gamingSummary?.parentElement instanceof HTMLDetailsElement)
            gamingSummary.parentElement.open = true;
          gamingSummary?.focus();
          return;
        }
        notice.textContent =
          'Откройте раздел «Устройства» для выбора игрового пресета или консольного режима.';
      },
    ),
    createScenarioCard(
      'tspu-check',
      'Не грузится видео или сайт',
      'Диагностика по 4 этапам (DNS → TCP → TLS → лимит ТСПУ 16–20 КБ) и добавление в обход.',
      () => {
        const pane = activateMapTab('diagnostic');
        if (pane) {
          const tspuInput = pane.querySelector<HTMLElement>(
            'input[name="tspu_domain"]',
          );
          tspuInput?.focus();
          tspuInput?.scrollIntoView?.({ block: 'center' });
          notice.textContent = '';
          return;
        }
        check.open = true;
        domain.focus();
      },
    ),
    createScenarioCard(
      'torrents-direct',
      'Торренты и медиасервер мимо VPN',
      'BitTorrent и локальный TorrServer идут напрямую через провайдера, не нагружая сервер.',
      () => {
        const pane = activateMapTab('settings');
        if (pane) {
          const field =
            pane.querySelector<HTMLElement>(
              '#cbid\\.forkop\\.settings\\.bittorrent_direct',
            ) ||
            pane.querySelector<HTMLElement>(
              '#cbi-forkop-settings-bittorrent_direct input',
            ) ||
            pane.querySelector<HTMLElement>(
              '#cbi-forkop-settings-bittorrent_direct',
            );
          let parent = field?.parentElement;
          while (parent && parent !== pane) {
            if (parent instanceof HTMLDetailsElement) parent.open = true;
            parent = parent.parentElement;
          }
          field?.focus();
          field?.scrollIntoView?.({ block: 'center' });
          notice.textContent = '';
          return;
        }
        notice.textContent =
          'Откройте раздел «Настройки» → «Прямой трафик и торренты».';
      },
    ),
  );
  scenarios.append(scenarioGrid);
  const everyday = el('div', '', 'fkp-next-content');
  everyday.append(status, server);
  root.append(everyday, scenarios);
  const traffic = el('section', '', 'fkp-next-panel fkp-next-traffic');
  const trafficOutput = el('div');
  traffic.append(el('h3', 'Трафик'), trafficOutput);
  root.append(traffic);
  const routes = el('section', '', 'fkp-next-panel fkp-next-routes');
  const routesHead = el('div', '', 'fkp-next-section-head');
  routesHead.append(
    el('h3', 'Дополнительные маршруты'),
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
  const routesOutput = el(
    'div',
    'Данные маршрутов пока недоступны.',
    'fkp-next-routes-list',
  );
  routes.append(routesHead, routesOutput);
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
            primarySectionName = primary?.sectionName || undefined;
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
              const prefix =
                group === primary &&
                group.displayName === serverHeading.textContent
                  ? ''
                  : `${group.displayName}: `;
              row.append(
                el(
                  'p',
                  `${prefix}${outbound?.displayName || 'сервер не выбран'}`,
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
  const refreshControl = action('Обновить данные', refresh);
  heroRefs.refresh = refreshControl;
  if (adapters.workspace) {
    heroOverflowPopover.prepend(refreshControl);
    decorateActionMenuItems(heroOverflowPopover);
  } else {
    header.append(refreshControl);
  }
  syncServiceControlPlacement();
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
