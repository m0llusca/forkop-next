import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

type Option = {
  validate: (section: string, value: string) => true | string;
  description: string;
};
function settings() {
  const options: Record<string, Option> = {};
  const source = readFileSync(
    '../luci-app-forkop/htdocs/luci-static/resources/view/forkop/settings.js',
    'utf8',
  );
  const module = new Function(
    'baseclass',
    'form',
    'main',
    'uci',
    'widgets',
    source,
  )(
    { extend: (v: unknown) => v },
    {},
    {
      FORKOP_UCI_PACKAGE: 'forkop',
      DNS_SERVER_OPTIONS: {},
      BOOTSTRAP_DNS_SERVER_OPTIONS: {},
      getClashUIUrl: () => '',
    },
    {},
    {},
  );
  module.createSettingsContent(
    {
      option: (
        _type: unknown,
        name: string,
        _label: string,
        description: string,
      ) => {
        const option = { description, value: () => {}, depends: () => {} };
        options[name] = option as unknown as Option;
        return option;
      },
    },
    {},
  );
  return options;
}

for (const [name, max] of [
  ['dns_rewrite_ttl', '4294967295'],
  ['badwan_reload_delay', '2147483647'],
]) {
  it.each([
    '',
    ' ',
    ' 60',
    '60 ',
    '1.5',
    '-1',
    '20junk',
    '+2',
    '1e3',
    String(BigInt(max) + 1n),
  ])(`${name} rejects ambiguous/out-of-range %j`, (value) => {
    expect(settings()[name].validate('settings', value)).not.toBe(true);
  });
  it.each(['0', '1', max])(`${name} accepts integer boundary %s`, (value) => {
    expect(settings()[name].validate('settings', value)).toBe(true);
  });
}
