// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { enhanceForkopForms } from '../../workspace/formGuide';

type NativeOption = {
  type: unknown;
  option: string;
  label: string;
  description: string;
  default?: string;
  rmempty?: boolean;
  write?: unknown;
  uciconfig?: string;
  ucisection?: string;
  ucioption?: string;
  dependencies: unknown[][];
};

function settings(translate = (value: string) => value) {
  const options = new Map<string, NativeOption>();
  const flag = Symbol('native form.Flag');
  const config: Record<string, Record<string, unknown>> = {
    settings: { https_domain_routing: '0' },
    main: { '.type': 'section', domain: ['example.com'], action: 'connection' },
  };
  const before = structuredClone(config);
  const uci = {
    get: vi.fn((_package: string, section: string, key?: string) =>
      key ? config[section]?.[key] : config[section],
    ),
    set: vi.fn(
      (_package: string, section: string, key: string, value: unknown) => {
        config[section][key] = value;
      },
    ),
    unset: vi.fn((_package: string, section: string, key: string) => {
      delete config[section][key];
    }),
  };
  const source = readFileSync(
    '../luci-app-forkop/htdocs/luci-static/resources/view/forkop/settings.js',
    'utf8',
  );
  const module = new Function(
    'form',
    'uci',
    'baseclass',
    'widgets',
    'main',
    '_',
    source,
  )(
    { Flag: flag },
    uci,
    { extend: (value: unknown) => value },
    {},
    {
      FORKOP_UCI_PACKAGE: 'forkop',
      DNS_SERVER_OPTIONS: {},
      BOOTSTRAP_DNS_SERVER_OPTIONS: {},
      getClashUIUrl: () => '',
    },
    translate,
  );
  const section = {
    option(type: unknown, option: string, label: string, description: string) {
      const field = {
        type,
        option,
        label,
        description,
        dependencies: [] as unknown[][],
        value() {},
        depends(...dependency: unknown[]) {
          this.dependencies.push(dependency);
        },
      };
      options.set(option, field);
      return field;
    },
  };
  module.createSettingsContent(section, {});
  return { options, flag, uci, config, before };
}

afterEach(() => document.body.replaceChildren());

it('offers a persistent, initially disabled native HTTPS flag without changing Main', () => {
  const { options, flag, uci, config, before } = settings();
  const option = options.get('https_domain_routing');
  expect(option).toBeDefined();
  expect(option!.type).toBe(flag);
  expect(option!.option).toBe('https_domain_routing');
  expect(option!.uciconfig).toBeUndefined();
  expect(option!.ucisection).toBeUndefined();
  expect(option!.ucioption).toBeUndefined();
  expect(option!.label).toBe('Inspect HTTPS domains');
  expect(option!.default).toBe('0');
  expect(option!.rmempty).toBe(false);
  expect(option!.dependencies).toEqual([]);
  // Native Flag owns persistence to this settings option; no cross-section writer.
  expect(option!.write).toBeUndefined();
  expect(uci.set).not.toHaveBeenCalled();
  expect(uci.unset).not.toHaveBeenCalled();
  expect(config).toEqual(before);
  expect(option!.description).toMatch(/existing routing rules/i);
  expect(option!.description).toMatch(/saved IP/i);
  expect(option!.description).toMatch(/configured source LAN/i);
  expect(option!.description).toMatch(/does not force all traffic to Main/i);
  expect(option!.description).toMatch(/TLS is not decrypted/i);
  expect(option!.description).toMatch(/CPU/i);
});

it('keeps the HTTPS control visible beside the source LAN in the current settings layout', () => {
  const scope = document.createElement('div');
  scope.className = 'fkp-workspace';
  const parent = document.createElement('div');
  parent.id = 'cbi-forkop-settings';
  for (const key of [
    'dns_type',
    'source_network_interfaces',
    'https_domain_routing',
  ]) {
    const field = document.createElement('div');
    field.id = `${parent.id}-${key}`;
    field.className = 'cbi-value';
    parent.append(field);
  }
  scope.append(parent);
  document.body.append(scope);
  enhanceForkopForms(scope);
  const source = parent.querySelector(
    '#cbi-forkop-settings-source_network_interfaces',
  )!;
  const https = parent.querySelector(
    '#cbi-forkop-settings-https_domain_routing',
  )!;
  expect(https.parentElement).toBe(source.parentElement);
  expect(https.closest('details')).toBeNull();
  expect(https.parentElement!.querySelector('h3')?.textContent).toBe(
    'Сетевые интерфейсы',
  );
});

it('renders the HTTPS label and scope explanation from the shipped Russian catalog', () => {
  const catalog = new Map<string, string>();
  const po = readFileSync('../luci-app-forkop/po/ru/forkop.po', 'utf8');
  for (const match of po.matchAll(/^msgid (".*")\r?\nmsgstr (".*")$/gm)) {
    catalog.set(JSON.parse(match[1]), JSON.parse(match[2]));
  }
  const { options } = settings((message) => catalog.get(message) || message);
  const option = options.get('https_domain_routing');
  expect(option?.label).toBe('Проверять домены HTTPS');
  expect(option?.description).toMatch(/сохран[её]нный IP/i);
  expect(option?.description).toMatch(/исходн.*локальн.*сет/i);
  expect(option?.description).toMatch(/TLS не расшифровывается/);
  expect(option?.description).toMatch(/нагрузк.*процессор/i);
});
