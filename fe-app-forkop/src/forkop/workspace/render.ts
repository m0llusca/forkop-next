import { store } from '../services/store.service';
import { isServiceTransitionStatus } from '../tabs/diagnostic/serviceTransition';
import { enhanceForkopForms } from './formGuide';

const pageHelp: Record<string, string> = {
  next: '',
  dashboard:
    'Выберите удалённый сервер для каждого подключения. Проверка задержки и смена сервера выполняются отдельно.',
  server:
    'Настройте, как роутер будет принимать подключения других клиентов: протокол, доступ, защита и маршрут трафика.',
  section:
    'Определите, какой трафик направлять через подключение, пропускать напрямую или блокировать. Порядок правил задаёт приоритет.',
  rule_tools:
    'Добавьте правило на время или просмотрите рекомендации Smart Detect перед их применением.',
  devices:
    'Назначьте устройству маршрут или игровой пресет. Условия для отдельных сайтов и исключения находятся в правилах.',
  diagnostic:
    'Начните с диагностики: она проверит DNS, ядро и маршрутизацию. Журнал и управление сервисом доступны ниже.',
  route_tools:
    'Узнайте, какое правило выбирается для сайта, и отдельно проверьте его доступность.',
  monitoring:
    'Посмотрите текущие соединения, трафик и журнал работы. Данные обновляются, пока раздел открыт.',
  settings:
    'Настройте DNS, сетевые интерфейсы, доступ к контроллеру и расписание обновлений. Параметры системы собраны отдельно.',
  updates:
    'Проверьте версии и управляйте установленными компонентами. Наличие новой версии само по себе не подтверждает совместимость.',
  advanced:
    'Проверьте совместимость с 3x-ui и Xray, сравните профили, сохраните конфигурацию или восстановите её.',
};

const groups = [
  { id: 'home', label: 'Главная', pages: [['next', 'Подключение']] },
  {
    id: 'servers',
    label: 'Серверы',
    pages: [
      ['dashboard', 'Исходящие подключения'],
      ['server', 'Входящие подключения'],
    ],
  },
  {
    id: 'rules',
    label: 'Правила',
    pages: [
      ['section', 'Правила маршрутизации'],
      ['rule_tools', 'Временные правила и рекомендации'],
    ],
  },
  {
    id: 'devices',
    label: 'Устройства',
    pages: [['devices', 'Маршруты устройств']],
  },
  {
    id: 'diagnostics',
    label: 'Диагностика',
    pages: [
      ['diagnostic', 'Проверки'],
      ['route_tools', 'Проверка маршрута'],
      ['monitoring', 'Мониторинг'],
    ],
  },
  {
    id: 'settings',
    label: 'Настройки',
    pages: [
      ['settings', 'Основные'],
      ['updates', 'Компоненты'],
      ['advanced', 'Расширенные настройки'],
    ],
  },
];
interface WorkspaceMount {
  menu: HTMLElement;
  panes: HTMLElement;
  main: HTMLElement;
  content: HTMLElement;
  disposed: () => boolean;
  theme: () => string;
  dispose: () => void;
}
const mounted = new WeakMap<HTMLElement, WorkspaceMount>();
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text = '',
) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
function setText(node: HTMLElement, text: string) {
  if (node.textContent !== text) node.textContent = text;
}

/** Adapt the native map in place: LuCI owns fields, parsing and tab activation. */
export function mountForkopWorkspace(root: HTMLElement): void {
  const previous = mounted.get(root);
  const intact =
    previous &&
    root.contains(previous.menu) &&
    root.contains(previous.panes) &&
    root.contains(previous.main);
  if (intact && !previous.disposed()) return;
  const previousTheme = previous?.theme();
  previous?.dispose();
  // A detached and later reused map may still have its original shell. Unwrap
  // only that intact instance; native renderContents() already clears its root.
  if (intact) root.replaceChildren(...previous.content.childNodes);
  const menu = root.querySelector<HTMLElement>('.cbi-tabmenu');
  const panes = root.querySelector<HTMLElement>('.cbi-map-tabbed');
  if (!menu || !panes) return;
  root.classList.add('fkp-workspace');
  menu.classList.add('fkp-workspace-native-tabs');
  const originalContent = [...root.childNodes];
  const sidebar = el('aside', 'fkp-workspace-sidebar');
  const brand = el('div', 'fkp-workspace-brand', 'Forkop');
  const primary = el('nav', 'fkp-workspace-primary');
  primary.setAttribute('aria-label', 'Разделы Forkop');
  sidebar.append(brand, primary);
  const main = el('div', 'fkp-workspace-main');
  const top = el('div', 'fkp-workspace-top');
  const status = el('div', 'fkp-workspace-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const service = el(
    'span',
    'fkp-workspace-service',
    'Состояние сервиса неизвестно',
  );
  const connection = el(
    'span',
    'fkp-workspace-connection',
    'Соединение ещё не проверено',
  );
  status.append(service, connection);
  const themeLabel = el('label', 'fkp-workspace-theme', 'Тема');
  const theme = el('select', '');
  theme.setAttribute('aria-label', 'Тема Forkop');
  for (const [value, label] of [
    ['auto', 'Как в LuCI'],
    ['light', 'Светлая'],
    ['dark', 'Тёмная'],
  ]) {
    const option = el('option', '', label);
    option.value = value;
    theme.append(option);
  }
  theme.value = previousTheme || 'auto';
  themeLabel.append(theme);
  top.append(status, themeLabel);
  const heading = el('h2', 'fkp-workspace-title');
  const description = el('p', 'fkp-workspace-description');
  const secondary = el('div', 'fkp-workspace-secondary');
  const content = el('div', 'fkp-workspace-content');
  content.append(...originalContent);
  main.append(top, heading, description, secondary, content);
  root.append(sidebar, main);

  let disposed = false;
  let wasConnected = root.isConnected;
  let navigationSignature = '';
  const markedModals = new Set<HTMLElement>();
  const modalContent = new WeakMap<HTMLElement, Element>();
  function surroundingTheme(): string {
    for (
      let parent: HTMLElement | null = root.parentElement || document.body;
      parent;
      parent = parent.parentElement
    ) {
      const choice =
        parent.dataset.theme || parent.getAttribute('data-darkmode');
      if (choice === 'light' || choice === 'dark') return choice;
      if (choice === 'true') return 'dark';
      if (choice === 'false') return 'light';
      if (
        parent.classList.contains('dark') ||
        parent.classList.contains('dark-mode')
      )
        return 'dark';
      if (
        parent.classList.contains('light') ||
        parent.classList.contains('light-mode')
      )
        return 'light';
    }
    const scheme = getComputedStyle(document.documentElement).colorScheme;
    if (scheme === 'dark' || scheme === 'light') return scheme;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  function applyTheme() {
    root.dataset.theme =
      theme.value === 'auto' ? surroundingTheme() : theme.value;
    for (const modal of markedModals) modal.dataset.theme = root.dataset.theme;
  }
  function markModals() {
    for (const modal of document.querySelectorAll<HTMLElement>('.modal')) {
      if (
        !modal.querySelector(
          '[id^="cbi-forkop"], [id^="cbid.forkop."], [class^="fkp_"], [class*=" fkp_"], [class^="fkp-"], [class*=" fkp-"]',
        )
      )
        continue;
      if (!modal.classList.contains('fkp-workspace-modal')) {
        modal.classList.add('fkp-workspace-modal');
        markedModals.add(modal);
      }
      if (modal.dataset.theme !== root.dataset.theme)
        modal.dataset.theme = root.dataset.theme;
      const content =
        modal.querySelector(':scope > h4') || modal.firstElementChild;
      const newContent = content != null && modalContent.get(modal) !== content;
      enhanceForkopForms(modal);
      if (newContent && content) {
        modalContent.set(modal, content);
        modal.scrollTop = 0;
      }
    }
    for (const modal of markedModals)
      if (!modal.isConnected) markedModals.delete(modal);
  }
  function availableTabs() {
    const tabs = new Map<string, HTMLAnchorElement | HTMLButtonElement>();
    for (const item of menu!.querySelectorAll<HTMLElement>('[data-tab]')) {
      const link = item.querySelector<HTMLAnchorElement | HTMLButtonElement>(
        'a, button',
      );
      const id = item.dataset.tab!;
      // cbi-tab-disabled means inactive, not capability-hidden.
      if (
        !link ||
        item.hidden ||
        link.hidden ||
        item.classList.contains('hidden') ||
        item.getAttribute('aria-hidden') === 'true' ||
        item.style.display === 'none' ||
        link.style.display === 'none' ||
        getComputedStyle(item).display === 'none'
      )
        continue;
      if (panes!.querySelector(`[data-tab="${id}"]`)) tabs.set(id, link);
    }
    return tabs;
  }
  function sync() {
    if (disposed) return;
    const tabs = availableTabs();
    const errors = (id: string) => {
      const native = tabs.get(id)?.closest<HTMLElement>('[data-tab]');
      const count = Number(native?.dataset.errors || 0);
      return {
        count: Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0,
        tooltip: native?.dataset.tooltip || '',
      };
    };
    const markErrors = (
      control: Element | null,
      count: number,
      description: string,
      label: string,
    ) => {
      if (!control) return;
      if (count) {
        control.setAttribute('data-errors', String(count));
        control.setAttribute('data-tooltip', description);
        control.setAttribute('data-tooltip-style', 'error');
        control.setAttribute('aria-label', `${label}: ${description}`);
      } else {
        for (const attr of [
          'data-errors',
          'data-tooltip',
          'data-tooltip-style',
          'aria-label',
        ])
          control.removeAttribute(attr);
      }
    };
    const active =
      panes!.querySelector<HTMLElement>(':scope > [data-tab-active="true"]')
        ?.dataset.tab ||
      menu!.querySelector<HTMLElement>('.cbi-tab:not(.cbi-tab-disabled)')
        ?.dataset.tab ||
      '';
    setText(description, pageHelp[active] || '');
    description.hidden = !description.textContent;
    const signature = [...tabs.keys()].join(',');
    if (signature !== navigationSignature) {
      navigationSignature = signature;
      primary.replaceChildren();
      secondary.replaceChildren();
      for (const group of groups) {
        const pages = group.pages.filter(([id]) => tabs.has(id));
        if (!pages.length) continue;
        const button = el('button', 'fkp-workspace-nav-button', group.label);
        button.type = 'button';
        button.dataset.workspaceSection = group.id;
        primary.append(button);
        const local = el('nav', 'fkp-workspace-local');
        local.setAttribute('aria-label', `${group.label}: страницы`);
        local.dataset.workspaceGroup = group.id;
        for (const [id, label] of pages) {
          const tab = el('button', 'fkp-workspace-local-button', label);
          tab.type = 'button';
          tab.dataset.workspaceTab = id;
          local.append(tab);
        }
        secondary.append(local);
      }
    }
    for (const group of groups) {
      const current = group.pages.some(([id]) => id === active);
      const button = primary.querySelector(
        `[data-workspace-section="${group.id}"]`,
      );
      if (current) button?.setAttribute('aria-current', 'page');
      else button?.removeAttribute('aria-current');
      const invalidPages = group.pages
        .map(([id, label]) => ({ ...errors(id), label }))
        .filter((page) => page.count);
      markErrors(
        button,
        invalidPages.reduce((total, page) => total + page.count, 0),
        invalidPages
          .map(
            (page) =>
              `${page.label}: ${page.tooltip || `${page.count} — ошибки в полях`}`,
          )
          .join('; '),
        group.label,
      );
      const local = secondary.querySelector<HTMLElement>(
        `[data-workspace-group="${group.id}"]`,
      );
      if (local) {
        const hidden = !current || local.childElementCount < 2;
        if (local.hidden !== hidden) local.hidden = hidden;
      }
      if (current) setText(heading, group.label);
    }
    for (const tab of secondary.querySelectorAll<HTMLElement>(
      '[data-workspace-tab]',
    )) {
      if (tab.dataset.workspaceTab === active)
        tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
      const error = errors(tab.dataset.workspaceTab!);
      markErrors(
        tab,
        error.count,
        error.tooltip || `${error.count} — ошибки в полях`,
        tab.textContent || '',
      );
    }
    const overview = root.querySelector('.fkp-next-overview');
    const sharedService = store.get().servicesInfoWidget;
    const sharedText = sharedService.failed
      ? 'Состояние сервиса недоступно. Обновите данные.'
      : isServiceTransitionStatus(sharedService.data.forkopStatus)
        ? 'Выполняется действие сервиса…'
        : !sharedService.loading && sharedService.data.forkopRunning === 1
          ? 'Сервис запущен'
          : !sharedService.loading && sharedService.data.forkopRunning === 0
            ? 'Сервис остановлен'
            : undefined;
    const overviewText =
      overview?.querySelector('.fkp-next-service')?.textContent;
    setText(
      service,
      (active === 'next'
        ? overviewText || sharedText
        : sharedText ||
          (overviewText
            ? `Последнее состояние: ${overviewText}`
            : undefined)) || 'Состояние сервиса неизвестно',
    );
    setText(
      connection,
      overview?.querySelector('.fkp-next-connection')?.textContent ||
        'Соединение ещё не проверено',
    );
  }
  function navigate(event: Event) {
    if (disposed || !(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLElement>(
      '[data-workspace-section], [data-workspace-tab]',
    );
    if (!control) return;
    const tabs = availableTabs();
    const group = groups.find((g) => g.id === control.dataset.workspaceSection);
    const id =
      control.dataset.workspaceTab ||
      group?.pages.find(([page]) => tabs.has(page))?.[0];
    if (id) tabs.get(id)?.click();
    sync();
  }
  primary.addEventListener('click', navigate);
  secondary.addEventListener('click', navigate);
  theme.addEventListener('change', applyTheme);
  const unsubscribeService = store.subscribe((_next, _previous, diff) => {
    if (diff.servicesInfoWidget) sync();
  });
  const observer = new MutationObserver((records) => {
    if (
      records.some((record) => {
        const target =
          record.target instanceof Element
            ? record.target
            : record.target.parentElement;
        return (
          target?.matches(
            '.cbi-value,.cbi-input-invalid,[aria-invalid="true"]',
          ) ||
          [...record.addedNodes].some(
            (node) =>
              node instanceof Element &&
              (node.matches('.cbi-value') || node.querySelector('.cbi-value')),
          )
        );
      })
    )
      enhanceForkopForms(root);
    // Telemetry tables can replace hundreds of rows. Only native navigation,
    // pane replacement and overview evidence affect this shell.
    if (
      records.some((record) => {
        const target =
          record.target instanceof Element
            ? record.target
            : record.target.parentElement;
        return (
          target &&
          (menu.contains(target) ||
            target === panes ||
            target.parentElement === panes ||
            target.closest('.fkp-next-overview'))
        );
      })
    )
      sync();
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      'data-tab-active',
      'hidden',
      'style',
      'class',
      'aria-hidden',
      'data-errors',
      'data-tooltip',
      'data-tooltip-style',
      'aria-invalid',
    ],
  });
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener('change', applyTheme);
  const themeObserver = new MutationObserver(applyTheme);
  for (const surface of [document.documentElement, document.body])
    themeObserver.observe(surface, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-darkmode', 'class', 'style'],
    });
  const lifecycle = new MutationObserver((records) => {
    if (root.isConnected) wasConnected = true;
    if (wasConnected && !root.isConnected) {
      dispose();
      return;
    }
    if (
      records.some((record) => {
        const target =
          record.target instanceof Element
            ? record.target
            : record.target.parentElement;
        return (
          target?.closest('.modal') ||
          [...record.addedNodes].some(
            (node) =>
              node instanceof Element &&
              (node.matches('.modal') || node.querySelector('.modal')),
          )
        );
      })
    )
      markModals();
  });
  function dispose() {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    lifecycle.disconnect();
    themeObserver.disconnect();
    unsubscribeService();
    primary.removeEventListener('click', navigate);
    secondary.removeEventListener('click', navigate);
    theme.removeEventListener('change', applyTheme);
    media?.removeEventListener('change', applyTheme);
    for (const modal of markedModals) {
      modal.classList.remove('fkp-workspace-modal');
      delete modal.dataset.theme;
    }
    markedModals.clear();
  }
  mounted.set(root, {
    menu,
    panes,
    main,
    content,
    disposed: () => disposed,
    theme: () => theme.value,
    dispose,
  });
  lifecycle.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'aria-invalid', 'hidden', 'style'],
  });
  applyTheme();
  enhanceForkopForms(root);
  markModals();
  sync();
}
