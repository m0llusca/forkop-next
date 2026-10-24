import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function settings(
  config: Record<string, string | undefined> = {},
  input: Record<string, string> = { enable_yacd: '1' },
) {
  // Native Flag.parse writes its current checkbox value when rmempty is false.
  const nativeFlagParse = async function (
    this: { formvalue: (section: string) => string | undefined },
    section: string,
  ) {
    config.enable_yacd = this.formvalue(section);
  };
  const fields = new Map<
    string,
    {
      dependencies: Array<[string, string]>;
      password?: boolean;
      validate?: (section: string, value: string) => boolean | string;
      cfgvalue: (section: string) => string | undefined;
      formvalue: (section: string) => string | undefined;
      parse?: (section: string) => Promise<unknown>;
      rmempty?: boolean;
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
        parse: async (_section: string) => undefined,
        cfgvalue: (_section: string): string | undefined => config[name],
        formvalue(_section: string): string | undefined {
          return input[name] ?? this.cfgvalue(_section);
        },
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
    { Flag: { prototype: { parse: nativeFlagParse } } },
    { get: (_package: string, _section: string, name: string) => config[name] },
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
  return {
    secret: fields.get('yacd_secret_key')!,
    enabled: fields.get('enable_yacd')!,
  };
}

describe('native controller settings', () => {
  it('lets LAN dashboard users configure a secret without enabling WAN access', () => {
    expect(settings().secret.dependencies).toContainEqual(['enable_yacd', '1']);
  });

  it('requires a nonempty secret before enabling remote dashboard access', () => {
    const field = settings().secret;
    expect(field.validate?.('settings', '')).not.toBe(true);
    expect(field.validate?.('settings', 'fixture-secret')).toBe(true);
  });

  it('masks the management secret in its native form field', () => {
    expect(settings().secret.password).toBe(true);
  });

  it('treats legacy enabled-without-secret as remote access off so unrelated saves remain valid', async () => {
    const config: Record<string, string | undefined> = { enable_yacd: '1' };
    const { secret, enabled } = settings(config, {});
    expect(enabled.cfgvalue('settings')).toBe('0');
    expect(config.enable_yacd).toBe('1'); // Rendering does not change UCI.
    expect(secret.rmempty).toBe(true);
    expect(secret.validate?.('settings', '')).toBe(true);
    await expect(enabled.parse?.('settings')).resolves.toBeUndefined();
    expect(config.enable_yacd).toBe('0');
    expect(config.yacd_secret_key).toBeUndefined();
  });

  it('rejects new remote enable without a secret even when optional empty-field validation is skipped', async () => {
    const config = { enable_yacd: '0' };
    const { enabled } = settings(config, {
      enable_yacd: '1',
      yacd_secret_key: '',
    });
    await expect(enabled.parse?.('settings')).rejects.toThrow('secret');
    expect(config.enable_yacd).toBe('0');
  });

  it('permits explicitly enabling remote access with an entered secret', async () => {
    const { secret, enabled } = settings(
      {},
      { enable_yacd: '1', yacd_secret_key: 'fixture-secret' },
    );
    expect(secret.validate?.('settings', 'fixture-secret')).toBe(true);
    await expect(enabled.parse?.('settings')).resolves.toBeUndefined();
  });

  it('keeps valid configured remote access enabled and rejects whitespace secrets', async () => {
    const valid = settings(
      { enable_yacd: '1', yacd_secret_key: 'fixture-secret' },
      {},
    );
    expect(valid.enabled.cfgvalue('settings')).toBe('1');
    const empty = settings(
      { enable_yacd: '1', yacd_secret_key: '  ' },
      { enable_yacd: '1', yacd_secret_key: '  ' },
    );
    expect(empty.enabled.cfgvalue('settings')).toBe('0');
    await expect(empty.enabled.parse?.('settings')).rejects.toThrow('secret');
  });
});
