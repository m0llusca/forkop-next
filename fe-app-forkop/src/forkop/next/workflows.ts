export type WorkflowTarget = {
  name: string;
  label?: string;
  action?: string;
  localProxyConfigured?: boolean;
  generated?: boolean;
};
export type TargetUse = 'device' | 'route' | 'probe' | 'smart';
export function targetEligibility(
  target: WorkflowTarget,
  use: TargetUse,
): {
  eligible: boolean;
  reason: string;
  settingsOption?: 'action' | 'mixed_proxy_enabled';
} {
  const connection = ['connection', 'proxy', 'outbound', 'vpn'].includes(
    target.action || '',
  );
  if (use === 'device') return { eligible: true, reason: '' }; // device_set accepts any enabled section.
  if (use === 'route' && target.generated === true)
    return {
      eligible: false,
      reason:
        'Сгенерированное правило нельзя использовать как цель нового правила',
    };
  if (use === 'route')
    return connection || ['bypass', 'block'].includes(target.action || '')
      ? { eligible: true, reason: '' }
      : {
          eligible: false,
          reason: target.action
            ? 'Это действие не поддерживает такой маршрут'
            : 'Тип маршрута неизвестен — откройте настройки',
        };
  if (use === 'smart' && !connection)
    return {
      eligible: false,
      reason: 'Smart Detect требует подключение с локальным прокси',
      settingsOption: 'action',
    };
  return target.localProxyConfigured === true
    ? { eligible: true, reason: '' }
    : {
        eligible: false,
        reason:
          target.localProxyConfigured === false
            ? 'Настройте локальный прокси в этом правиле'
            : 'Настройка локального прокси неизвестна — откройте правило',
        settingsOption:
          connection ||
          ['byedpi', 'zapret', 'zapret2'].includes(target.action || '')
            ? 'mixed_proxy_enabled'
            : 'action',
      };
}
export function workflowError(error: unknown): string {
  const code =
    error instanceof Error ? error.message : String(error || 'request_failed');
  return (
    (
      {
        native_pending_changes:
          'Сначала примените или отмените изменения в редакторе, затем повторите действие. Черновик остаётся в редакторе.',
        native_mutation_busy:
          'Дождитесь завершения текущего применения, затем повторите действие.',
        native_refresh_required:
          'Обновите редактор кнопкой «Обновить редактор», затем повторите действие.',
      } as Record<string, string>
    )[code] || code
  );
}
export function requireIPv4(value: string): string {
  const address = value.trim();
  if (
    !/^\d+\.\d+\.\d+\.\d+$/.test(address) ||
    address
      .split('.')
      .some(
        (part) => Number(part) > 255 || (part.length > 1 && part[0] === '0'),
      )
  )
    throw Error(
      `Адрес устройства «${address}»: введите IPv4, например 192.168.1.20. Назначение IPv6 здесь пока не поддерживается; существующие настройки IPv6 сохраняются.`,
    );
  return address;
}
export type WorkflowContext = {
  targets?: Array<{
    name: string;
    localProxyConfigured: boolean;
    generated?: boolean;
  }>;
  loadDevices?: () => Promise<Record<string, string>>;
};
/** A synchronous, safe projection from the native map; no credentials or writes. */
export function workflowContext(root: HTMLElement): WorkflowContext {
  let context: WorkflowContext = {};
  const provider =
    root
      .closest('.cbi-map')
      ?.querySelector<HTMLElement>('.cbi-map-tabbed > [data-tab="section"]') ||
    root;
  provider.dispatchEvent(
    new CustomEvent('forkop:workflow-context', {
      bubbles: true,
      detail: {
        provide: (value: WorkflowContext) => {
          context = value;
        },
      },
    }),
  );
  return context;
}
let pickerId = 0;
export function attachDevicePicker(
  input: HTMLInputElement,
  root: HTMLElement,
): void {
  const list = document.createElement('datalist');
  list.id = `fkp-devices-${++pickerId}`;
  input.setAttribute('list', list.id);
  input.after(list);
  let loading = false;
  input.addEventListener('focus', async () => {
    const load = workflowContext(root).loadDevices;
    if (!load || loading) return;
    loading = true;
    try {
      const choices = await load();
      list.replaceChildren();
      for (const [address, name] of Object.entries(choices)) {
        try {
          requireIPv4(address);
        } catch {
          continue;
        }
        const option = document.createElement('option');
        option.value = address;
        option.label = `${name} — ${address}`;
        option.textContent = option.label;
        list.append(option);
      }
    } catch {
      /* Manual IPv4 entry remains available if DHCP hints cannot be read. */
    } finally {
      loading = false;
    }
  });
}

export type RuleDestination = {
  kind: 'create' | 'edit' | 'site';
  section?: string;
  option?: string;
};
/** Native section IDs are passed as data, never interpolated into selectors. */
export function navigateToRule(
  root: HTMLElement,
  destination: RuleDestination,
): boolean {
  const map = root.closest('.cbi-map') || root;
  const pane = [
    ...map.querySelectorAll<HTMLElement>('.cbi-map-tabbed > [data-tab]'),
  ].find((node) => node.dataset.tab === 'section');
  const tab = map.querySelector<HTMLElement>(
    '.cbi-tabmenu [data-tab="section"] a',
  );
  if (!pane || !tab) return false;
  tab.click();
  return !pane.dispatchEvent(
    new CustomEvent('forkop:navigate-rule', {
      cancelable: true,
      detail: destination,
    }),
  );
}
function siteValue(
  raw: string,
  subdomains: boolean,
): { value: string; description: string } {
  const text = raw.trim();
  if (
    /^(full|keyword|regex):/.test(text) &&
    !/[\r\n]/.test(text) &&
    text.indexOf(':') < text.length - 1
  )
    return {
      value: text,
      description:
        'Специальное условие сохраняется без изменений; проверка выполняется полным редактором.',
    };
  try {
    if (!text || /\s/.test(text)) throw Error();
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    const host = url.hostname;
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/i.test(host) ||
      !host.includes('.') ||
      host
        .split('.')
        .some(
          (part) =>
            !part ||
            part.length > 63 ||
            part.startsWith('-') ||
            part.endsWith('-'),
        ) ||
      /^[\d.]+$/.test(host)
    )
      throw Error();
    return {
      value: subdomains ? host : `full:${host}`,
      description: subdomains
        ? `${host} и все его поддомены`
        : `Только ${host}, без поддоменов`,
    };
  } catch {
    throw Error(
      `Сайт: неверный фрагмент «${text.includes('://') || text.includes('@') ? 'адрес URL' : text.split(/[/?#]/, 1)[0]}». Введите домен example.org или HTTP(S)-адрес сайта без логина и пароля.`,
    );
  }
}
/** Edits only the existing native textarea. Its parse, validation and save remain authoritative. */
export function renderQuickSite(
  textarea: HTMLTextAreaElement,
  label: string,
  priority: number,
): HTMLElement {
  const root = document.createElement('section');
  root.className = 'fkp-next-panel';
  const title = document.createElement('h3');
  title.textContent = 'Добавить сайт';
  const field = document.createElement('label');
  field.textContent = 'Сайт или адрес страницы';
  const input = document.createElement('input');
  input.setAttribute('aria-label', 'Сайт или адрес страницы');
  field.append(input);
  const scope = document.createElement('label');
  scope.textContent = 'Включая поддомены';
  const subdomains = document.createElement('input');
  subdomains.type = 'checkbox';
  subdomains.checked = true;
  scope.append(subdomains);
  const context = document.createElement('p');
  context.textContent = `Изменяется правило «${label}», приоритет ${priority}. Правила выше проверяются первыми; остальные условия этого правила сохраняются. Это дополнение к существующим доменам, не отдельное правило.`;
  const preview = document.createElement('output');
  preview.setAttribute('aria-live', 'polite');
  const add = document.createElement('button');
  add.type = 'button';
  add.textContent = 'Добавить в черновик правила';
  add.disabled = textarea.disabled || textarea.readOnly;
  input.disabled = add.disabled;
  subdomains.disabled = add.disabled;
  const update = () => {
    try {
      const site = siteValue(input.value, subdomains.checked);
      preview.textContent = site.description;
      input.removeAttribute('aria-invalid');
      return site.value;
    } catch (error) {
      preview.textContent = workflowError(error);
      input.setAttribute('aria-invalid', 'true');
      return undefined;
    }
  };
  input.oninput = update;
  subdomains.onchange = update;
  add.onclick = () => {
    if (textarea.disabled || textarea.readOnly) return;
    const value = update();
    if (!value) return;
    const lines = textarea.value.split(/\r?\n/).map((line) => line.trim());
    if (!lines.includes(value)) {
      textarea.value = `${textarea.value.trimEnd()}${textarea.value.trim() ? '\n' : ''}${value}`;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }
    preview.textContent +=
      ' Добавлено в черновик. Сохраните редактор, затем примените изменения.';
  };
  root.append(title, context, field, scope, preview, add);
  return root;
}

type NativeRuleSection = {
  map: { config: string; data: { get(config: string, name: string): unknown } };
  uciconfig?: string;
  renderContents(...args: unknown[]): HTMLElement;
  renderMoreOptionsModal(name: string, event?: Event): unknown;
  getActiveModalMap(): HTMLElement;
};
/** Uses the existing GridSection modal; all native add/save/cancel hooks stay in place. */
export function configureRuleWorkflow(section: NativeRuleSection): void {
  let destination: RuleDestination | undefined;
  let lastSection = '';
  let table: HTMLElement;
  const render = section.renderContents;
  const modal = section.renderMoreOptionsModal;
  const notice = document.createElement('p');
  notice.setAttribute('role', 'status');
  const returnNotice = document.createElement('p');
  returnNotice.setAttribute('role', 'status');
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = 'Вернуться к выбору узла';
  back.hidden = true;
  back.onclick = () => {
    const map = table.closest('.cbi-map');
    map
      ?.querySelector<HTMLElement>('.cbi-tabmenu [data-tab="dashboard"] a')
      ?.click();
    const target = [
      ...(map?.querySelectorAll<HTMLElement>('[data-connection-section]') ||
        []),
    ].find((node) => node.dataset.connectionSection === lastSection);
    returnNotice.remove();
    if (target) {
      target.tabIndex = -1;
      target.focus();
      target.scrollIntoView?.({ block: 'center' });
      notice.textContent = '';
    } else {
      returnNotice.textContent =
        'Группа появится на странице серверов после применения и успешного разбора источников. Проверьте результат обновления подписки.';
      map
        ?.querySelector('.cbi-map-tabbed > [data-tab="dashboard"]')
        ?.prepend(returnNotice);
    }
  };
  section.renderMoreOptionsModal = function (name, event) {
    const requested = destination;
    destination = undefined;
    return Promise.resolve(modal.call(this, name, event)).then((result) => {
      if (!requested) return result;
      lastSection = name;
      const sourceWorkflow =
        requested.kind === 'create' ||
        (requested.kind === 'edit' &&
          (!requested.option ||
            [
              'selector_proxy_links',
              'subscription_url',
              'interfaces',
              'outbound_jsons',
              'urltest',
              'priority_group',
            ].includes(requested.option)));
      back.hidden = !sourceWorkflow;
      notice.textContent = sourceWorkflow
        ? 'Сохраните редактор, затем примените изменения. После разбора источников вернитесь к выбору узла. Пропуски и ошибки источников смотрите в результате обновления подписки.'
        : 'Сохраните редактор, затем примените изменения правила.';
      const root = this.getActiveModalMap();
      const option =
        requested.option ||
        (requested.kind === 'site' ? 'domain' : 'selector_proxy_links');
      const field = [...root.querySelectorAll<HTMLElement>('[id]')].find(
        (node) =>
          node.id ===
          `cbid.${this.uciconfig || this.map.config}.${name}.${option}`,
      );
      const tab =
        option === 'domain' || option === 'fully_routed_ips'
          ? 'conditions'
          : 'settings';
      root
        .querySelector<HTMLElement>(`.cbi-tabmenu [data-tab="${tab}"] a`)
        ?.click();
      let parent = field?.parentElement;
      while (parent && parent !== root) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
        parent = parent.parentElement;
      }
      const input = field?.matches('input,textarea,select')
        ? field
        : field?.querySelector<HTMLElement>('input,textarea,select');
      input?.focus();
      field?.scrollIntoView?.({ block: 'center' });
      return result;
    });
  };
  section.renderContents = function (...args) {
    table = render.apply(this, args);
    table.append(notice, back);
    table.addEventListener('forkop:navigate-rule', (event) => {
      event.preventDefault();
      const requested = (event as CustomEvent<RuleDestination>).detail;
      destination = requested;
      if (requested.kind === 'create') {
        const create = table.querySelector<HTMLButtonElement>(
          '.cbi-section-create button',
        );
        if (create && !create.disabled) create.click();
        else {
          destination = undefined;
          notice.textContent =
            'Не удалось открыть создание: редактор недоступен.';
        }
        return;
      }
      if (
        !requested.section ||
        !this.map.data.get(this.uciconfig || this.map.config, requested.section)
      ) {
        destination = undefined;
        notice.textContent = 'Правило не найдено. Обновите данные.';
        return;
      }
      void Promise.resolve()
        .then(() => this.renderMoreOptionsModal(requested.section!, event))
        .catch(() => {
          destination = undefined;
          notice.textContent =
            'Не удалось открыть редактор. Повторите действие.';
        });
    });
    for (const row of table.querySelectorAll<HTMLElement>('tr[data-sid]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Добавить сайт';
      button.onclick = () =>
        navigateToRule(table, { kind: 'site', section: row.dataset.sid });
      (
        row.querySelector('.cbi-section-actions') || row.lastElementChild
      )?.append(button);
    }
    return table;
  };
}
