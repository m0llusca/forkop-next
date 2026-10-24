interface Group {
  title: string;
  help?: string;
  collapsed?: boolean;
}
const initializedGroups = new WeakSet<HTMLElement>();

const settingsGroups: Record<string, Group> = {
  dns: {
    title: 'DNS и разрешение имён',
    help: 'Как роутер получает адреса сайтов и серверов. Настройки IPv4 и IPv6 остаются здесь.',
  },
  network: {
    title: 'Сетевые интерфейсы',
    help: 'Из какой сети принимать трафик и через какой интерфейс выходить в интернет.',
  },
  controller: {
    title: 'Доступ к контроллеру',
    help: 'YACD — отдельная панель управления. Для обычной работы через LuCI включать её не требуется.',
  },
  updates: {
    title: 'Обновления и загрузки',
    help: 'Расписание проверки компонентов и загрузки списков. Источники серверов и их подписки задаются в правилах.',
  },
  system: {
    title: 'Системные параметры',
    help: 'Хранение конфигурации и кэша, журнал, DHCP, QUIC и NTP.',
    collapsed: true,
  },
};
const ruleGroups: Record<string, Group> = {
  action: {
    title: 'Действие правила',
    help: 'Сначала выберите, что делать с трафиком. На вкладке «Условия» задайте, к каким сайтам и устройствам это относится.',
  },
  sources: {
    title: 'Источники подключения',
    help: 'Добавьте ссылки или подписку. Также доступны VPN-интерфейс, JSON, автоматический выбор URLTest и переключение по приоритету.',
  },
  dns: { title: 'DNS для этого правила' },
  advanced: {
    title: 'Каскад, локальный прокси и дополнительные параметры',
    help: 'Промежуточный сервер, HTTP/SOCKS-доступ, разрешение IP и отображение серверов.',
    collapsed: true,
  },
  other: { title: 'Параметры выбранного действия' },
};
const conditionGroups: Record<string, Group> = {
  destinations: {
    title: 'Сайты, адреса и списки',
    help: 'Укажите домены и IP вручную или выберите готовые списки. Форматы и условия сопоставления указаны у каждого поля.',
  },
  devices: {
    title: 'Устройства и охват правила',
    help: 'Фильтр устройства ограничивает условия, а принудительная маршрутизация направляет весь его трафик. Эти режимы имеют разный смысл.',
  },
  other: { title: 'Дополнительные условия' },
};
const inboundGroups: Record<string, Group> = {
  access: {
    title: 'Протокол и доступ',
    help: 'Входящее подключение принимает клиентов на этом роутере. Для выбора удалённого сервера откройте «Исходящие подключения».',
  },
  security: { title: 'Защита соединения: TLS и REALITY' },
  transport: { title: 'Транспорт' },
  credentials: { title: 'Учётные данные и параметры протокола' },
  route: { title: 'Маршрут входящего трафика' },
};

function keyOf(field: HTMLElement): string {
  return field.id.slice(field.id.lastIndexOf('-') + 1);
}
function settingsGroup(key: string): string {
  if (/^(dns_|bootstrap_dns)/.test(key)) return 'dns';
  if (
    /^(source_network|enable_output|output_network|enable_badwan|badwan)/.test(
      key,
    )
  )
    return 'network';
  if (/^(enable_yacd|yacd_)/.test(key)) return 'controller';
  if (
    /^(list_update|update_interval|component_update|download_|latency_test)/.test(
      key,
    )
  )
    return 'updates';
  return 'system';
}
function ruleGroup(key: string): string {
  if (['enabled', 'label', 'action'].includes(key)) return 'action';
  if (
    [
      'selector_proxy_links',
      'subscription_url',
      'interfaces',
      'outbound_jsons',
      'urltest',
      'priority_group',
    ].includes(key)
  )
    return 'sources';
  if (/^(dns_|bootstrap_dns)/.test(key)) return 'dns';
  if (
    /^(outbound_detour|mixed_proxy|sort_by_latency|resolve_real_ip|dashboard_filter)/.test(
      key,
    )
  )
    return 'advanced';
  return 'other';
}
function conditionGroup(key: string): string {
  if (['source_ip_cidr', 'fully_routed_ips'].includes(key)) return 'devices';
  if (
    [
      'domain',
      'ip_cidr',
      'community_lists',
      'rule_set',
      'domain_ip_lists',
      '_dns_rule_set',
      '_dns_domain_ip_lists',
    ].includes(key)
  )
    return 'destinations';
  return 'other';
}
function inboundGroup(key: string): string {
  if (/^(tls_|reality_|security$|client_fingerprint)/.test(key))
    return 'security';
  if (/^transport/.test(key)) return 'transport';
  if (/^(route_|routing_|outbound|detour)/.test(key)) return 'route';
  if (
    /^(server_(username|password)|socks_auth|shadowsocks_|vmess_|vless_|hysteria2_|mtproto_|tailscale_)/.test(
      key,
    )
  )
    return 'credentials';
  return 'access';
}
function hiddenField(field: HTMLElement): boolean {
  // Do not inherit the inactive native tab's visibility: LuCI owns that state.
  return (
    field.hidden ||
    field.classList.contains('hidden') ||
    field.style.display === 'none' ||
    field.getAttribute('aria-hidden') === 'true'
  );
}

/** Move existing native row nodes only. LuCI still owns every option and widget. */
export function enhanceForkopForms(scope: HTMLElement): void {
  if (!scope.matches('.fkp-workspace,.fkp-workspace-modal')) return;
  const parents = new Set<HTMLElement>();
  for (const field of scope.querySelectorAll<HTMLElement>(
    '.cbi-value[id^="cbi-forkop-"]',
  )) {
    const parent = field.parentElement;
    if (parent && !parent.classList.contains('fkp-form-group'))
      parents.add(parent);
  }
  for (const parent of parents) {
    const fields = [...parent.children].filter(
      (node): node is HTMLElement =>
        node instanceof HTMLElement && node.classList.contains('cbi-value'),
    );
    const keys = fields.map(keyOf);
    let definitions: Record<string, Group>, classify: (key: string) => string;
    if (parent.id === 'cbi-forkop-settings' && keys.includes('dns_type')) {
      definitions = settingsGroups;
      classify = settingsGroup;
    } else if (parent.dataset.tab === 'settings' && keys.includes('action')) {
      definitions = ruleGroups;
      classify = ruleGroup;
    } else if (parent.dataset.tab === 'conditions' && keys.includes('domain')) {
      definitions = conditionGroups;
      classify = conditionGroup;
    } else if (keys.includes('protocol') && keys.includes('enabled')) {
      definitions = inboundGroups;
      classify = inboundGroup;
    } else continue;
    const groups = new Map<string, HTMLElement>();
    for (const field of fields) {
      const key = classify(keyOf(field));
      let group = groups.get(key);
      if (!group) {
        const definition = definitions[key];
        group = document.createElement(
          definition.collapsed ? 'details' : 'section',
        );
        group.className = 'fkp-form-group';
        const title = document.createElement(
          definition.collapsed ? 'summary' : 'h3',
        );
        title.textContent = definition.title;
        group.append(title);
        if (definition.help) {
          const help = document.createElement('p');
          help.className = 'fkp-form-help';
          help.textContent = definition.help;
          group.append(help);
        }
        parent.insertBefore(group, field);
        groups.set(key, group);
      }
      group.append(field);
    }
    for (const key of Object.keys(definitions)) {
      const group = groups.get(key);
      if (group) parent.append(group);
    }
  }
  for (const group of scope.querySelectorAll<HTMLElement>('.fkp-form-group')) {
    const fields = [...group.children].filter(
      (node): node is HTMLElement =>
        node instanceof HTMLElement && node.classList.contains('cbi-value'),
    );
    const hidden = fields.every(hiddenField);
    if (group.hidden !== hidden) group.hidden = hidden;
    if (
      group instanceof HTMLDetailsElement &&
      !group.open &&
      (group.querySelector(
        '[aria-invalid="true"],.cbi-input-invalid,.cbi-value-error,[data-invalid="true"]',
      ) ||
        (!initializedGroups.has(group) &&
          group.querySelector('input[type="checkbox"]:checked')))
    )
      group.open = true;
    initializedGroups.add(group);
  }
}
