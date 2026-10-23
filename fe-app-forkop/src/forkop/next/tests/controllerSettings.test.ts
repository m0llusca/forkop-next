import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function settings() {
  const fields = new Map<
    string,
    {
      dependencies: Array<[string, string]>;
      password?: boolean;
      validate?: (section: string, value: string) => boolean | string;
    }
  >();
  const section = {
    option: (_type: unknown, name: string) => {
      const field = {
        dependencies: [] as Array<[string, string]>,
        depends(key: string, value: string) {
          this.dependencies.push([key, value]);
        },
        value() {},
      };
      fields.set(name, field);
      return field;
    },
  };
  const source = readFileSync(
    new URL(
      '../../../../../luci-app-forkop/htdocs/luci-static/resources/view/forkop/settings.js',
      import.meta.url,
    ),
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
    {},
    {},
    { extend: (value: unknown) => value },
    {},
    {
      DNS_SERVER_OPTIONS: {},
      BOOTSTRAP_DNS_SERVER_OPTIONS: {},
      getClashUIUrl: () => '',
    },
    (value: string) => value,
  );
  module.createSettingsContent(section, {});
  return fields.get('yacd_secret_key')!;
}

describe('native controller settings', () => {
  it('lets LAN dashboard users configure a secret without enabling WAN access', () => {
    expect(settings().dependencies).toContainEqual(['enable_yacd', '1']);
  });

  it('requires a nonempty secret before enabling remote dashboard access', () => {
    const field = settings();
    expect(field.validate?.('settings', '')).not.toBe(true);
    expect(field.validate?.('settings', 'fixture-secret')).toBe(true);
  });

  it('masks the management secret in its native form field', () => {
    expect(settings().password).toBe(true);
  });
});
