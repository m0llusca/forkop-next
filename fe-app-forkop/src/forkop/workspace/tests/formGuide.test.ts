// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { enhanceForkopForms } from '../formGuide';

afterEach(() => document.body.replaceChildren());

function fields(keys: string[], id = 'cbi-forkop-settings', tab = '') {
  const scope = document.createElement('div');
  scope.className = 'fkp-workspace';
  const parent = document.createElement('div');
  parent.className = 'cbi-section-node';
  parent.id = id;
  if (tab) parent.dataset.tab = tab;
  scope.append(parent);
  for (const key of keys) {
    const row = document.createElement('div');
    row.className = 'cbi-value';
    row.id = `${id}-${key}`;
    const label = document.createElement('label');
    label.textContent = key;
    const input = document.createElement('input');
    input.name = key;
    input.value = `draft-${key}`;
    input.id = `widget.${id}.${key}`;
    label.htmlFor = input.id;
    row.append(label, input);
    parent.append(row);
  }
  document.body.append(scope);
  return { scope, parent };
}

it('groups global settings by task without recreating fields, changing values or losing listeners', () => {
  const { scope, parent } = fields([
    'dns_type',
    'dns_server',
    'source_network_interfaces',
    'enable_yacd',
    'update_interval',
    'config_path',
    'future_setting',
  ]);
  const original = [...parent.querySelectorAll('input')];
  let changed = 0;
  original[0].addEventListener('change', () => changed++);
  enhanceForkopForms(scope);
  const titles = [...parent.querySelectorAll('h3,summary')].map(
    (n) => n.textContent,
  );
  expect(titles).toEqual([
    'DNS и разрешение имён',
    'Сетевые интерфейсы',
    'Доступ к контроллеру',
    'Обновления и загрузки',
    'Системные параметры',
  ]);
  expect([...parent.querySelectorAll('input')]).toEqual(original);
  expect(original[0].value).toBe('draft-dns_type');
  original[0].dispatchEvent(new Event('change'));
  expect(changed).toBe(1);
  expect(parent.querySelector('[name="future_setting"]')).toBe(original[6]);
  enhanceForkopForms(scope);
  expect(parent.querySelectorAll('.fkp-form-group')).toHaveLength(5);
});

it('keeps all six connection source types open and advanced fields accessible behind a named disclosure', () => {
  const { scope, parent } = fields(
    [
      'enabled',
      'label',
      'action',
      'selector_proxy_links',
      'subscription_url',
      'interfaces',
      'outbound_jsons',
      'urltest',
      'priority_group',
      'mixed_proxy_enabled',
      'outbound_detour_enabled',
    ],
    'cbi-forkop-home',
    'settings',
  );
  enhanceForkopForms(scope);
  const sourceGroup = [...parent.querySelectorAll('.fkp-form-group')].find(
    (n) => n.textContent?.includes('Источники подключения'),
  )!;
  for (const name of [
    'selector_proxy_links',
    'subscription_url',
    'interfaces',
    'outbound_jsons',
    'urltest',
    'priority_group',
  ]) {
    expect(sourceGroup.querySelector(`[name="${name}"]`)).not.toBeNull();
    expect(sourceGroup.closest('details')).toBeNull();
  }
  const advanced = parent.querySelector('details')!;
  expect(advanced).not.toBeNull();
  expect(advanced.open).toBe(false);
  expect(advanced.querySelector('summary')?.textContent).toContain('Каскад');
  expect(advanced.querySelector('[name="mixed_proxy_enabled"]')).not.toBeNull();
});

it('reveals an invalid field inside an advanced group and preserves native conditional visibility', () => {
  const { scope, parent } = fields(
    ['label', 'action', 'mixed_proxy_enabled', 'mixed_proxy_port', 'dns_type'],
    'cbi-forkop-main',
    'settings',
  );
  const dns = parent.querySelector<HTMLElement>('[id$="-dns_type"]')!;
  dns.classList.add('hidden');
  enhanceForkopForms(scope);
  const advanced = parent.querySelector('details')!;
  expect(advanced.open).toBe(false);
  const input = advanced.querySelector<HTMLInputElement>(
    '[name="mixed_proxy_port"]',
  )!;
  input.setAttribute('aria-invalid', 'true');
  enhanceForkopForms(scope);
  expect(advanced.open).toBe(true);
  expect(dns.classList.contains('hidden')).toBe(true);
  expect(dns.closest<HTMLElement>('.fkp-form-group')!.hidden).toBe(true);
  dns.classList.remove('hidden');
  enhanceForkopForms(scope);
  expect(dns.closest<HTMLElement>('.fkp-form-group')!.hidden).toBe(false);
});

it('keeps device scope distinct from destination conditions and includes unknown future fields', () => {
  const { scope, parent } = fields(
    [
      'domain',
      'ip_cidr',
      'source_ip_cidr',
      'fully_routed_ips',
      'ports',
      'future_condition',
    ],
    'cbi-forkop-main',
    'conditions',
  );
  enhanceForkopForms(scope);
  expect(
    parent
      .querySelector('[name="domain"]')
      ?.closest('.fkp-form-group')
      ?.querySelector('h3')?.textContent,
  ).toBe('Сайты, адреса и списки');
  expect(
    parent
      .querySelector('[name="fully_routed_ips"]')
      ?.closest('.fkp-form-group')
      ?.querySelector('h3')?.textContent,
  ).toBe('Устройства и охват правила');
  expect(parent.querySelector('[name="future_condition"]')).not.toBeNull();
});

it('groups inbound security and transport while keeping required credentials visible', () => {
  const { scope, parent } = fields(
    [
      'enabled',
      'protocol',
      'listen_port',
      'server_password',
      'security',
      'reality_private_key',
      'transport',
      'transport_path',
      'mtproto_secret',
      'tailscale_auth_key',
    ],
    'cbi-forkop-listener',
  );
  enhanceForkopForms(scope);
  expect(
    parent
      .querySelector('[name="reality_private_key"]')
      ?.closest('.fkp-form-group')
      ?.querySelector('h3')?.textContent,
  ).toBe('Защита соединения: TLS и REALITY');
  expect(
    parent.querySelector('[name="server_password"]')?.closest('details'),
  ).toBeNull();
  expect(
    parent.querySelector('[name="mtproto_secret"]')?.closest('details'),
  ).toBeNull();
  expect(
    parent.querySelector('[name="tailscale_auth_key"]')?.closest('details'),
  ).toBeNull();
  expect(parent.querySelectorAll('input')).toHaveLength(10);
});

it('does not reorganize other applications, nested source editors or table cells', () => {
  const { scope, parent } = fields(['url', 'interval'], 'cbi-forkop-group');
  enhanceForkopForms(scope);
  expect(parent.querySelector('.fkp-form-group')).toBeNull();
  expect(parent.children).toHaveLength(2);
});

it('keeps an advanced group closed after the user closes it, even with an enabled option', () => {
  const { scope, parent } = fields(
    ['label', 'action', 'mixed_proxy_enabled'],
    'cbi-forkop-main',
    'settings',
  );
  const enabled = parent.querySelector<HTMLInputElement>(
    '[name="mixed_proxy_enabled"]',
  )!;
  enabled.type = 'checkbox';
  enabled.checked = true;
  enhanceForkopForms(scope);
  const details = parent.querySelector('details')!;
  expect(details.open).toBe(true);
  details.open = false;
  enhanceForkopForms(scope);
  expect(details.open).toBe(false);
  enabled.setAttribute('aria-invalid', 'true');
  enhanceForkopForms(scope);
  expect(details.open).toBe(true);
});
