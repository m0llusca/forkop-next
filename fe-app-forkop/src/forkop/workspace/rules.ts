import { parseValueList } from '../../helpers/parseValueList';

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

function sourceSummary(rule: Rule): string {
  return (
    [
      countLabel('Ссылки', list(rule.selector_proxy_links).length),
      countLabel('Подписки', list(rule.subscription_url).length),
      countLabel('Интерфейсы', list(rule.interfaces).length),
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
      countLabel('URLTest', list(rule.urltest).length),
      countLabel('Приоритет', list(rule.priority_group).length),
    ]
      .filter(Boolean)
      .join(' · ') || 'Источники не заданы'
  );
}

function routeSummary(rule: Rule): string {
  switch (rule.action || 'connection') {
    case 'connection':
      return sourceSummary(rule);
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
      return 'Сохранены прежние настройки подключения';
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
