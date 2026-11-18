import { parseValueList } from '../../helpers/parseValueList';
import { ensureRowOverflowMenu } from './actionMenu';

type Rule = Record<string, unknown>;

/** Labels describe UI actions; stored UCI action identifiers remain untouched. */
export function getRuleActionLabel(value: unknown): string {
  const action = String(value || 'connection');
  const labels: Record<string, string> = {
    connection: 'Через подключение',
    bypass: 'Напрямую',
    block: 'Блокировать',
    dns: 'Свой DNS',
    zapret: 'Zapret',
    zapret2: 'Zapret2',
    byedpi: 'ByeDPI',
    proxy: 'Через прокси (старое правило)',
    vpn: 'Через VPN (старое правило)',
    outbound: 'Через JSON (старое правило)',
  };
  if (Object.prototype.hasOwnProperty.call(labels, action))
    return labels[action];
  // Unknown identifiers remain distinguishable, without echoing an arbitrary
  // malformed value which could contain a pasted URL, credential or markup.
  return /^[\w-]{1,40}$/.test(action)
    ? `Неизвестное действие: ${action}`
    : 'Неизвестное действие';
}

function list(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((item) => typeof item === 'string' && item.trim());
  return typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : [];
}

function conditionCount(rule: Rule, key: string): number {
  const primary = conditions(rule, [key]);
  return primary.length || conditions(rule, [`${key}_text`]).length;
}

function conditions(rule: Rule, keys: string[]): string[] {
  return [
    ...new Set(
      keys.flatMap((key) => {
        const values = Array.isArray(rule[key]) ? rule[key] : [rule[key]];
        return values.flatMap((value) =>
          typeof value === 'string' ? parseValueList(value) : [],
        );
      }),
    ),
  ];
}

function countLabel(label: string, count: number): string {
  return count ? `${label}: ${count > 999 ? '999+' : count}` : '';
}

function scopeSummary(rule: Rule): string {
  const dnsOnly = rule.action === 'dns';
  const domains = conditions(rule, [
    'domain',
    'domain_suffix',
    'domain_suffix_text',
    'domain_text',
    'domain_keyword',
    'domain_keyword_text',
    'domain_regex',
    'domain_regex_text',
  ]);
  const customLists = new Set(
    [
      ...list(rule.rule_set),
      // DNS rejects subnet extraction and does not generate these matchers.
      ...(dnsOnly ? [] : list(rule.rule_set_with_subnets)),
    ].map((reference) => reference.trim()),
  );
  const lists =
    list(rule.community_lists).length +
    customLists.size +
    list(rule.domain_ip_lists).length;
  return (
    [
      countLabel('Домены', domains.length),
      countLabel('Списки', lists),
      dnsOnly
        ? ''
        : countLabel('IP назначения', conditionCount(rule, 'ip_cidr')),
      dnsOnly ? '' : countLabel('Порты', conditionCount(rule, 'ports')),
      countLabel('Фильтр устройств', conditionCount(rule, 'source_ip_cidr')),
      countLabel(
        dnsOnly ? 'DNS всех запросов устройств' : 'Принудительно для устройств',
        list(rule.fully_routed_ips).length,
      ),
    ]
      .filter(Boolean)
      .join(' · ') || 'Условия не заданы'
  );
}

function numericCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function sourceSummary(rule: Rule): string {
  const subCount = Math.max(
    list(rule.subscription_url).length + list(rule.subscription_urls).length,
    numericCount(rule.subscription_urls_count),
  );
  const ifaceCount = Math.max(
    list(rule.interfaces).length + list(rule.interface).length,
    numericCount(rule.interfaces_count),
  );
  const urltestCount = Math.max(
    list(rule.urltest).length + list(rule.urltests).length,
    numericCount(rule.urltest_count),
  );
  const priorityCount = Math.max(
    list(rule.priority_group).length + list(rule.priority_groups).length,
    numericCount(rule.priority_group_count),
  );
  return (
    [
      countLabel('Ссылки', list(rule.selector_proxy_links).length),
      countLabel('Подписки', subCount),
      countLabel('Интерфейсы', ifaceCount),
      countLabel(
        'JSON',
        Array.isArray(rule.outbound_jsons)
          ? rule.outbound_jsons.filter(
              (item) => typeof item === 'string' && item.trim(),
            ).length
          : typeof rule.outbound_jsons === 'string' &&
              rule.outbound_jsons.trim()
            ? 1
            : 0,
      ),
      countLabel('URLTest', urltestCount),
      countLabel('Приоритет', priorityCount),
    ]
      .filter(Boolean)
      .join(' · ') || 'Источники не заданы'
  );
}

function routeSummary(rule: Rule): string {
  const consoleBadge =
    rule.console_mode === '1' || rule.console_mode === true
      ? ' · Консольный режим (UDP напрямую)'
      : '';
  switch (rule.action || 'connection') {
    case 'connection':
      return `${sourceSummary(rule)}${consoleBadge}`;
    case 'bypass':
      return 'Обычный маршрут роутера';
    case 'block':
      return 'Блокировка совпавших обращений';
    case 'dns':
      return 'DNS по настройкам правила';
    case 'zapret':
    case 'zapret2':
    case 'byedpi':
      return 'Обработка по настройкам правила';
    case 'proxy':
    case 'vpn':
    case 'outbound':
      return `Сохранены прежние настройки подключения${consoleBadge}`;
    default:
      return 'Проверьте действие в редакторе';
  }
}

function textNode(tag: string, className: string, text: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/** Display-only DOM. Never reads child endpoints or mutates a native form. */
export function renderRuleIdentity(
  value: Rule | null | undefined,
  id: string,
): HTMLElement {
  const rule = value || {};
  const root = document.createElement('div');
  root.className = 'fkp-rule-identity';
  root.append(textNode('strong', 'fkp-rule-name', String(rule.label || id)));
  if (rule.enabled === '0')
    root.append(textNode('span', 'fkp-rule-state', 'Выключено'));
  root.append(textNode('span', 'fkp-rule-scope', scopeSummary(rule)));
  return root;
}

export function renderRuleRoute(value: Rule | null | undefined): HTMLElement {
  const rule = value || {};
  const root = document.createElement('div');
  root.className = 'fkp-rule-routing';
  root.append(
    textNode('strong', 'fkp-rule-action', getRuleActionLabel(rule.action)),
    textNode('span', 'fkp-rule-route', routeSummary(rule)),
  );
  return root;
}

export function normalizeNamedSectionTable(
  root: ParentNode,
  headerLabel = 'Правило',
): void {
  const theadRow = root.querySelector<HTMLElement>(
    'tr.cbi-section-table-titles, .tr.cbi-section-table-titles',
  );
  const hadNamedPseudo = Boolean(
    theadRow &&
      (theadRow.classList.contains('named') ||
        theadRow.hasAttribute('data-title')),
  );
  if (theadRow) {
    if (hadNamedPseudo) {
      theadRow.classList.remove('named');
      theadRow.removeAttribute('data-title');
      if (!theadRow.querySelector(':scope > [data-fkp-name-header]')) {
        const nameHeader = textNode(
          'th',
          'th cbi-section-table-cell',
          headerLabel,
        );
        nameHeader.dataset.fkpNameHeader = '';
        theadRow.prepend(nameHeader);
      }
    } else {
      const firstHeader = theadRow.firstElementChild as HTMLElement | null;
      if (firstHeader && firstHeader.textContent?.trim() === 'Name') {
        firstHeader.textContent = headerLabel;
      }
    }
  }
  for (const row of root.querySelectorAll<HTMLElement>(
    'tr.cbi-section-table-row[data-sid]',
  )) {
    if (!row.querySelector(':scope > .cbi-section-table-titles')) {
      const titleCell = textNode(
        'td',
        'td cbi-value-field cbi-section-table-titles',
        row.getAttribute('data-title') || row.dataset.sid || '',
      );
      row.prepend(titleCell);
    }
  }
  if (hadNamedPseudo) {
    const placeholderTd = root.querySelector<HTMLTableCellElement>(
      'tr.placeholder > td[colspan]',
    );
    if (placeholderTd && placeholderTd.colSpan > 0) {
      placeholderTd.colSpan += 1;
    }
  }
}

export function ensureRuleActionsBar(actions: Element): HTMLElement {
  const existing = actions.querySelector<HTMLElement>(
    ':scope > .fkp-rule-actions-bar',
  );
  if (existing) return existing;
  const nativeDiv = actions.querySelector<HTMLElement>(
    ':scope > div:not(.cbi-dropdown):not(.fkp-rule-order)',
  );
  if (nativeDiv) {
    nativeDiv.classList.add('fkp-rule-actions-bar');
    return nativeDiv;
  }
  const bar = textNode('div', 'fkp-rule-actions-bar', '');
  bar.append(...actions.childNodes);
  actions.append(bar);
  return bar;
}

/** Keep native fields mounted; UCI's move operation owns persisted priority. */
export function configureRuleOrder(
  root: HTMLElement,
  move: (id: string, reference: string, after: boolean) => boolean,
): void {
  normalizeNamedSectionTable(root, 'Правило');
  const status = textNode('p', 'fkp-rule-order-status', '');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  root.append(status);
  const rows = () => [
    ...root.querySelectorAll<HTMLElement>('tr.cbi-section-table-row[data-sid]'),
  ];
  function update() {
    const ordered = rows();
    ordered.forEach((row, index) => {
      row.querySelector<HTMLButtonElement>('[data-rule-order=up]')!.disabled =
        index === 0;
      row.querySelector<HTMLButtonElement>('[data-rule-order=down]')!.disabled =
        index === ordered.length - 1;
    });
  }
  for (const row of rows()) {
    const name =
      row.querySelector('.fkp-rule-name')?.textContent || row.dataset.sid!;
    row
      .querySelector<HTMLInputElement>('input[type=checkbox]')
      ?.setAttribute('aria-label', `Включить правило ${name}`);
    const actions = row.querySelector('.cbi-section-actions');
    const controls = textNode('div', 'fkp-rule-order', '');
    for (const [direction, label, glyph] of [
      ['up', 'Выше', '↑'],
      ['down', 'Ниже', '↓'],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cbi-button fkp-rule-order-btn';
      button.dataset.ruleOrder = direction;
      button.textContent = glyph;
      button.title = label;
      button.setAttribute('aria-label', `${label}: ${name}`);
      button.addEventListener('click', () => {
        const ordered = rows();
        const index = ordered.indexOf(row);
        const after = direction === 'down';
        const reference = ordered[index + (after ? 1 : -1)];
        if (!reference) return;
        try {
          if (!move(row.dataset.sid!, reference.dataset.sid!, after))
            throw new Error('move_rejected');
          row.parentElement!.insertBefore(
            row,
            after ? reference.nextSibling : reference,
          );
          update();
          if (button.disabled)
            row
              .querySelector<HTMLButtonElement>(
                `[data-rule-order=${after ? 'up' : 'down'}]`,
              )
              ?.focus();
          else button.focus();
          status.textContent = `${name}: позиция ${rows().indexOf(row) + 1} из ${ordered.length}. Порядок изменён в черновике. Сохраните и примените изменения.`;
          row.dispatchEvent(new Event('change', { bubbles: true }));
        } catch {
          status.textContent = `Не удалось изменить порядок правила «${name}». Повторите действие.`;
        }
      });
      controls.append(button);
    }
    if (actions) {
      const bar = ensureRuleActionsBar(actions);
      bar.prepend(controls);
      ensureRowOverflowMenu(bar, name);
    }
  }
  update();
  // Native drag/drop remains an optional input path and moves existing rows.
  const observer = new MutationObserver(update);
  const body = root.querySelector('tbody');
  if (body) observer.observe(body, { childList: true });
}
