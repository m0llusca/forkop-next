// @vitest-environment happy-dom
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isCopyableProxyLink } from '../../../helpers/isCopyableProxyLink';
import { validateOutboundJson } from '../../../validators/validateOutboundJson';
import { validateProxyUrl } from '../../../validators/validateProxyUrl';
import { maskGlobalCheckText } from '../../tabs/diagnostic/helpers/maskDiagnostics';
import { renderSymptomGuide } from '../../tabs/diagnostic/symptomGuide';
import { renderAdvancedPanel } from '../../next/advanced';
import { renderDeviceProfileTools } from '../../next/tools';
import { enhanceForkopForms } from '../formGuide';

const repoRoot = path.resolve(process.cwd(), '..');
const luciForkopDir = path.join(
  repoRoot,
  'luci-app-forkop/htdocs/luci-static/resources/view/forkop',
);

// Valid 32-byte Curve25519 base64 keys containing raw '/' and '+'
const WG_PRIV_SLASH_PLUS = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFh/+E=';
const WG_PUB_SLASH_PLUS = 'YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJi/+I=';
const WG_PSK_VALID = 'Y2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2Nj/+M=';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Tier-2 Pack 1: WireGuard, AmneziaWG & Cloudflare WARP validators and helpers', () => {
  it('validates wireguard://, wg://, awg://, amneziawg:// with raw / and + in Curve25519 keys and CIDRs', async () => {
    const indexPath = path.resolve(process.cwd(), 'src/validators/index.ts');
    expect(fs.existsSync(indexPath)).toBe(true);
    const validatorsIndex = (await import(
      /* @vite-ignore */ indexPath
    )) as Record<string, unknown>;
    expect(typeof validatorsIndex.validateWireGuardUrl).toBe('function');

    const wgUrl = `wireguard://${WG_PRIV_SLASH_PLUS}@198.51.100.10:51820?publickey=${encodeURIComponent(WG_PUB_SLASH_PLUS)}&psk=${encodeURIComponent(WG_PSK_VALID)}&address=10.66.66.2/32,fd00:66::2/128&mtu=1420#WG-Node`;
    expect(validateProxyUrl(wgUrl).valid).toBe(true);

    const awgRawQueryUrl = `awg://${WG_PRIV_SLASH_PLUS}@vpn.example.com:51820?public_key=${WG_PUB_SLASH_PLUS}&ip=10.8.0.2/32&jc=4&jmin=40&jmax=70&s1=15&s2=30&h1=100-200&h2=201-300&h3=301-400&h4=401-500#AWG-Node`;
    expect(validateProxyUrl(awgRawQueryUrl).valid).toBe(true);

    const amneziaSchemeUrl = `amneziawg://[2001:db8::1]:51820?private_key=${WG_PRIV_SLASH_PLUS}&public_key=${WG_PUB_SLASH_PLUS}&jc=6&jmin=50&jmax=1000`;
    expect(validateProxyUrl(amneziaSchemeUrl).valid).toBe(true);

    const wgShortSchemeUrl = `wg://${WG_PRIV_SLASH_PLUS}@203.0.113.5:51820?publickey=${WG_PUB_SLASH_PLUS}`;
    expect(validateProxyUrl(wgShortSchemeUrl).valid).toBe(true);
  });

  it('rejects invalid Curve25519 keys, bad CIDRs, and out-of-range AmneziaWG parameters', () => {
    expect(
      validateProxyUrl(
        `wireguard://not-a-valid-key@198.51.100.10:51820?publickey=${encodeURIComponent(WG_PUB_SLASH_PLUS)}`,
      ).valid,
    ).toBe(false);

    expect(
      validateProxyUrl(`wireguard://${WG_PRIV_SLASH_PLUS}@198.51.100.10:51820`)
        .valid,
    ).toBe(false);

    expect(
      validateProxyUrl(
        `wireguard://${WG_PRIV_SLASH_PLUS}@198.51.100.10:51820?publickey=${WG_PUB_SLASH_PLUS}&address=999.999.1.1/32`,
      ).valid,
    ).toBe(false);

    // jc out of 1..128
    expect(
      validateProxyUrl(
        `awg://${WG_PRIV_SLASH_PLUS}@198.51.100.10:51820?publickey=${WG_PUB_SLASH_PLUS}&jc=129&jmin=40&jmax=70`,
      ).valid,
    ).toBe(false);

    // jmin > jmax
    expect(
      validateProxyUrl(
        `awg://${WG_PRIV_SLASH_PLUS}@198.51.100.10:51820?publickey=${WG_PUB_SLASH_PLUS}&jc=4&jmin=80&jmax=70`,
      ).valid,
    ).toBe(false);

    // jmax > 1280
    expect(
      validateProxyUrl(
        `awg://${WG_PRIV_SLASH_PLUS}@198.51.100.10:51820?publickey=${WG_PUB_SLASH_PLUS}&jc=4&jmin=40&jmax=1300`,
      ).valid,
    ).toBe(false);

    // s1 > 1280
    expect(
      validateProxyUrl(
        `awg://${WG_PRIV_SLASH_PLUS}@198.51.100.10:51820?publickey=${WG_PUB_SLASH_PLUS}&jc=4&jmin=40&jmax=70&s1=1500`,
      ).valid,
    ).toBe(false);

    // invalid h1 min > max
    expect(
      validateProxyUrl(
        `awg://${WG_PRIV_SLASH_PLUS}@198.51.100.10:51820?publickey=${WG_PUB_SLASH_PLUS}&jc=4&jmin=40&jmax=70&h1=300-200`,
      ).valid,
    ).toBe(false);
  });

  it('validates warp:// share links with auto or host:port and 1-sided AWG, rejecting 2-sided s1..h4', () => {
    expect(
      validateProxyUrl(
        `warp://${WG_PRIV_SLASH_PLUS}@auto?publickey=${encodeURIComponent(WG_PUB_SLASH_PLUS)}&address=172.16.0.2/32&reserved=12,34,56&jc=4&jmin=40&jmax=70#WARP-Auto`,
      ).valid,
    ).toBe(true);

    expect(
      validateProxyUrl(
        `warp://engage.cloudflareclient.com:2408?private_key=${WG_PRIV_SLASH_PLUS}&public_key=${WG_PUB_SLASH_PLUS}&i1=%3Cb%200xc0%3E#WARP-Host`,
      ).valid,
    ).toBe(true);

    expect(
      validateProxyUrl(`warp://auto?private_key=${WG_PRIV_SLASH_PLUS}&s1=20`)
        .valid,
    ).toBe(false);

    expect(
      validateProxyUrl(
        `warp://auto?private_key=${WG_PRIV_SLASH_PLUS}&h1=100-200`,
      ).valid,
    ).toBe(false);
  });

  it('validates wireguard and warp JSON outbounds in validateOutboundJson', () => {
    const validWgJson = JSON.stringify({
      type: 'wireguard',
      tag: 'wg-out',
      private_key: WG_PRIV_SLASH_PLUS,
      address: ['10.66.66.2/32', 'fd00:66::2/128'],
      peers: [
        {
          address: '198.51.100.10',
          port: 51820,
          public_key: WG_PUB_SLASH_PLUS,
        },
      ],
      amnezia: {
        jc: 4,
        jmin: 40,
        jmax: 70,
        s1: 15,
        s2: 30,
        h1: '100-200',
        h2: 205,
      },
    });
    expect(validateOutboundJson(validWgJson).valid).toBe(true);

    // Reject missing peers or invalid peer port
    expect(
      validateOutboundJson(
        JSON.stringify({
          type: 'wireguard',
          tag: 'wg-bad',
          private_key: WG_PRIV_SLASH_PLUS,
          address: ['10.66.66.2/32'],
          peers: [],
        }),
      ).valid,
    ).toBe(false);

    expect(
      validateOutboundJson(
        JSON.stringify({
          type: 'wireguard',
          tag: 'wg-bad-port',
          private_key: WG_PRIV_SLASH_PLUS,
          address: '10.66.66.2/32',
          peers: [
            {
              address: '198.51.100.10',
              port: 70000,
              public_key: WG_PUB_SLASH_PLUS,
            },
          ],
        }),
      ).valid,
    ).toBe(false);

    // Valid warp outbound with profile and 1-sided amnezia
    const validWarpJson = JSON.stringify({
      type: 'warp',
      tag: 'warp-out',
      profile: { id: 'reg-1', private_key: WG_PRIV_SLASH_PLUS },
      amnezia: { jc: 4, jmin: 40, jmax: 70, i1: '<b 0xc0>' },
    });
    expect(validateOutboundJson(validWarpJson).valid).toBe(true);

    // Reject s1..h4 or mtu on type === 'warp'
    expect(
      validateOutboundJson(
        JSON.stringify({
          type: 'warp',
          tag: 'warp-bad-s1',
          amnezia: { jc: 4, jmin: 40, jmax: 70, s1: 10 },
        }),
      ).valid,
    ).toBe(false);

    expect(
      validateOutboundJson(
        JSON.stringify({
          type: 'warp',
          tag: 'warp-bad-mtu',
          mtu: 1420,
        }),
      ).valid,
    ).toBe(false);
  });

  it('marks wireguard/wg/awg/amneziawg/warp links copyable and redacts URI secrets while preserving 2001:2::/48 FakeIPv6', () => {
    expect(isCopyableProxyLink('wireguard://key@1.2.3.4:51820')).toBe(true);
    expect(isCopyableProxyLink('wg://key@1.2.3.4:51820')).toBe(true);
    expect(isCopyableProxyLink('awg://key@1.2.3.4:51820')).toBe(true);
    expect(isCopyableProxyLink('amneziawg://key@1.2.3.4:51820')).toBe(true);
    expect(isCopyableProxyLink('warp://auto?private_key=abc')).toBe(true);

    const logSample = [
      `connect uri wireguard://${WG_PRIV_SLASH_PLUS}@198.51.100.10:51820?publickey=${WG_PUB_SLASH_PLUS}&psk=${WG_PSK_VALID}#WG`,
      `warp uri warp://auto?private_key=${WG_PRIV_SLASH_PLUS}&token=secret-warp-token&license_key=warp-plus-secret`,
      'resolved FakeIPv6 2001:2::1a2b and 2001:2:0:0::ff01 alongside ULA fd12:3456:789a::1',
    ].join('\n');

    const masked = maskGlobalCheckText(logSample);
    expect(masked).not.toContain(WG_PRIV_SLASH_PLUS);
    expect(masked).not.toContain(WG_PSK_VALID);
    expect(masked).not.toContain('secret-warp-token');
    expect(masked).not.toContain('warp-plus-secret');
    expect(masked).toContain('[REDACTED]');
    // Must preserve 2001:2::/48 FakeIPv6 without falsely redacting as ULA
    expect(masked).toContain('2001:2::1a2b');
    expect(masked).toContain('2001:2:0:0::ff01');
  });
});

describe('Tier-2 Packs 2, 3 & 5: Next API, TSPU Classifier, Route Explain & Console Gaming UI', () => {
  it('routes tspuClassify directly to unlocked forkop tspu_classify without mutation events', async () => {
    const apiMod = (await import('../../next/api')) as Record<string, unknown>;
    expect(typeof apiMod.tspuClassify).toBe('function');

    const events: string[] = [];
    const onChanging = () => events.push('changing');
    const onChanged = () => events.push('changed');
    window.addEventListener('forkop:configuration-changing', onChanging);
    window.addEventListener('forkop:configuration-changed', onChanged);

    const execCalls: unknown[][] = [];
    (globalThis as Record<string, unknown>).L = {
      resolveDefault: <T>(v: Promise<T>) => v,
    };
    (globalThis as Record<string, unknown>).fs = {
      exec: async (cmd: string, args: string[]) => {
        execCalls.push([cmd, args]);
        return {
          code: 0,
          stdout: JSON.stringify({
            success: true,
            data: {
              domain: 'youtube.com',
              section: 'direct',
              checked_at: 1700000000,
              verdict: 'tspu_byte_cap_16kb',
              severity: 'error',
              recommended_action: 'connection_or_dpi',
              remote_ip: '142.250.74.14',
              http_code: 200,
              bytes_read: 16384,
              stages: [
                { stage: 'dns', status: 'ok' },
                { stage: 'tcp', status: 'ok' },
                { stage: 'tls', status: 'ok' },
                { stage: 'byte_cap', status: 'failed', bytes_read: 16384 },
              ],
              comparison: null,
            },
          }),
          stderr: '',
        };
      },
    };

    try {
      const tspuClassify = apiMod.tspuClassify as (payload: {
        domain: string;
        section?: string;
        compare_section?: string;
      }) => Promise<{ success: boolean; data?: Record<string, unknown> }>;

      const res = await tspuClassify({
        domain: 'youtube.com',
        section: 'direct',
        compare_section: 'main',
      });
      expect(res.success).toBe(true);
      expect(res.data?.verdict).toBe('tspu_byte_cap_16kb');
      expect(events).toEqual([]);
      expect(execCalls).toEqual([
        [
          '/usr/bin/forkop',
          [
            'tspu_classify',
            JSON.stringify({
              domain: 'youtube.com',
              section: 'direct',
              compare_section: 'main',
            }),
          ],
        ],
      ]);
    } finally {
      window.removeEventListener('forkop:configuration-changing', onChanging);
      window.removeEventListener('forkop:configuration-changed', onChanged);
      delete (globalThis as Record<string, unknown>).L;
      delete (globalThis as Record<string, unknown>).fs;
    }
  });

  it('supports bittorrent/stun in route_explain and renders localized console_mode & bittorrent_direct reasons', async () => {
    const calls: Array<[string, unknown]> = [];
    const panel = renderAdvancedPanel(
      async (action, payload) => {
        calls.push([action, payload]);
        if (action === 'status') {
          return {
            success: true,
            data: {
              digest: 'd1',
              sections: [
                {
                  name: 'ps5',
                  label: 'PS5 Tunnel',
                  action: 'connection',
                  enabled: true,
                },
              ],
            },
          };
        }
        if (action === 'route_explain') {
          const p = payload as Record<string, unknown>;
          return {
            success: true,
            data: {
              decision: {
                status: 'direct',
                section: 'ps5',
                outbound: 'direct',
              },
              trace: [
                {
                  section: 'ps5',
                  match: 'yes',
                  reason:
                    p.protocol === 'bittorrent'
                      ? 'bittorrent_direct'
                      : 'console_udp_direct',
                },
              ],
            },
          };
        }
        return { success: true, data: {} };
      },
      undefined,
      false,
      'diagnostics',
    );
    document.body.append(panel);
    await new Promise((r) => setTimeout(r, 0));

    const protoSelect = panel.querySelector<HTMLSelectElement>(
      'select[name="route_protocol"]',
    )!;
    const protoValues = [...protoSelect.options].map((o) => o.value);
    expect(protoValues).toContain('bittorrent');
    expect(protoValues).toContain('stun');

    const domainInput = panel.querySelector<HTMLInputElement>(
      'input[name="domain"]',
    )!;
    domainInput.value = 'stun.playstation.net';
    protoSelect.value = 'stun';

    const explainBtn = [...panel.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Объяснить маршрут'),
    )!;
    explainBtn.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(panel.textContent).not.toContain('console_udp_direct');
    expect(panel.textContent).toMatch(/UDP.*напрямую|консол/i);

    protoSelect.value = 'bittorrent';
    protoSelect.dispatchEvent(new Event('change'));
    explainBtn.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(panel.textContent).not.toContain('bittorrent_direct');
    expect(panel.textContent).toMatch(/BitTorrent/i);
  });

  it('supports Console mode checkbox and console preset in Gaming quick-presets card', async () => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    const tools = renderDeviceProfileTools(async (action, payload) => {
      calls.push([action, payload]);
      if (action === 'status') {
        return {
          success: true,
          data: {
            sections: [
              {
                name: 'main',
                label: 'Main Proxy',
                action: 'connection',
                enabled: true,
              },
            ],
          },
        };
      }
      if (action === 'devices') return { success: true, data: { items: [] } };
      if (action === 'profile_list')
        return { success: true, data: { items: [] } };
      return { success: true, data: {} };
    });
    document.body.append(tools);
    await new Promise((r) => setTimeout(r, 0));

    const scopeSelect = tools.querySelector<HTMLSelectElement>(
      'select[aria-label="Охват игрового пресета"]',
    )!;
    const deviceInput = tools.querySelector<HTMLInputElement>(
      'input[aria-label="Игровое устройство"]',
    )!;
    const presetSelect = tools.querySelector<HTMLSelectElement>(
      'select[aria-label="Игровой пресет"]',
    )!;
    const routeSelect = tools.querySelector<HTMLSelectElement>(
      'select[aria-label="Игровой маршрут"]',
    )!;
    const consoleCheckbox = tools.querySelector<HTMLInputElement>(
      'input[type="checkbox"][data-gaming-console-mode]',
    );
    expect(consoleCheckbox).not.toBeNull();

    scopeSelect.value = 'selected';
    scopeSelect.dispatchEvent(new Event('change'));
    deviceInput.value = '192.168.1.55';
    deviceInput.dispatchEvent(new Event('input'));

    const presetValues = [...presetSelect.options].map((o) => o.value);
    expect(presetValues).toContain('console');

    presetSelect.value = 'playstation';
    routeSelect.value = 'main';
    consoleCheckbox!.checked = true;
    consoleCheckbox!.dispatchEvent(new Event('change'));

    const applyBtn = [...tools.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Применить игровой пресет'),
    )!;
    applyBtn.click();
    await new Promise((r) => setTimeout(r, 0));

    const gamingCall = calls.find(([a]) => a === 'gaming_apply');
    expect(gamingCall?.[1]).toMatchObject({
      preset: 'playstation',
      section: 'main',
      device: '192.168.1.55',
      console_mode: true,
    });
  });

  it('renders TSPU multi-stage block classifier (DNS, TCP, TLS ClientHello, 16-20 KB cap) with comparison pass', async () => {
    const calls: Array<[string, Record<string, unknown> | undefined]> = [];
    const guide = renderSymptomGuide(async (action, payload) => {
      calls.push([action, payload]);
      if (action === 'status') {
        return {
          success: true,
          data: {
            sections: [
              {
                name: 'main',
                label: 'Main Tunnel',
                action: 'connection',
                enabled: true,
              },
            ],
          },
        };
      }
      if (action === 'tspu_classify') {
        return {
          success: true,
          data: {
            domain: 'youtube.com',
            section: 'direct',
            checked_at: 1700000000,
            verdict: 'tspu_byte_cap_16kb',
            severity: 'blocked',
            recommended_action: 'connection_or_dpi',
            remote_ip: '142.250.74.14',
            http_code: 200,
            bytes_read: 16800,
            stages: [
              {
                stage: 'dns',
                status: 'ok',
                remote_ip: '142.250.74.14',
                duration_ms: 12,
              },
              { stage: 'tcp', status: 'ok', duration_ms: 25 },
              { stage: 'tls', status: 'ok', duration_ms: 48 },
              {
                stage: 'byte_cap',
                status: 'failed',
                verdict: 'tspu_byte_cap_16kb',
                bytes_read: 16800,
                http_code: 200,
                duration_ms: 5002,
              },
            ],
            comparison: {
              section: 'main',
              verdict: 'ok',
              bypass_verified: true,
            },
          },
        };
      }
      return { success: true, data: {} };
    });
    document.body.append(guide);
    await new Promise((r) => setTimeout(r, 0));

    // Startup only calls status
    expect(calls.map(([a]) => a)).toEqual(['status']);

    const tspuDomain = guide.querySelector<HTMLInputElement>(
      'input[name="tspu_domain"]',
    )!;
    const tspuCompare = guide.querySelector<HTMLSelectElement>(
      'select[name="tspu_compare_section"]',
    )!;
    const tspuButton = guide.querySelector<HTMLButtonElement>(
      'button[data-tspu-run]',
    )!;
    expect(tspuDomain).not.toBeNull();
    expect(tspuCompare).not.toBeNull();
    expect(tspuButton).not.toBeNull();

    tspuDomain.value = 'youtube.com';
    tspuCompare.value = 'main';
    tspuButton.click();
    await new Promise((r) => setTimeout(r, 0));

    const classifyCall = calls.find(([a]) => a === 'tspu_classify');
    expect(classifyCall?.[1]).toMatchObject({
      domain: 'youtube.com',
      section: 'direct',
      compare_section: 'main',
    });

    const stageNodes = guide.querySelectorAll('[data-tspu-stage]');
    expect(stageNodes.length).toBe(4);
    expect(guide.textContent).toMatch(/16[–-]20\s*КБ|16[–-]20\s*KB/i);
    expect(guide.textContent).toContain('TLS ClientHello');
    expect(guide.textContent).toContain('Main Tunnel');
  });
});

describe('Tier-2 Packs 1, 3, 4 & 5: Native LuCI settings.js, section.js & formGuide contracts', () => {
  it('defines opt-in bittorrent_direct and torrserver_direct flags in settings.js', () => {
    const settingsJs = fs.readFileSync(
      path.join(luciForkopDir, 'settings.js'),
      'utf8',
    );
    expect(settingsJs).toContain('"bittorrent_direct"');
    expect(settingsJs).toContain('Direct BitTorrent bypass');
    expect(settingsJs).toContain('"torrserver_direct"');
    expect(settingsJs).toContain('Direct router TorrServer bypass');
  });

  it('supports .yaml/.yml Clash lists, console_mode, wireguard/amneziawg/warp protocols, editor_preview, and WG/WARP modal in section.js', () => {
    const sectionJs = fs.readFileSync(
      path.join(luciForkopDir, 'section.js'),
      'utf8',
    );

    // Pack 4: Clash YAML lists alongside .lst
    const plainListBlock =
      sectionJs
        .split('function validatePlainListReference(')[1]
        ?.slice(0, 320) || '';
    expect(plainListBlock).toContain('".lst"');
    expect(plainListBlock).toContain('".yaml"');
    expect(plainListBlock).toContain('".yml"');

    // Pack 3: Console gaming mode
    expect(sectionJs).toContain('"console_mode"');
    expect(sectionJs).toContain('Console gaming mode (TCP proxy, UDP direct)');

    // Pack 1: Protocol filter choices
    const protoChoicesBlock =
      sectionJs.split('function proxyProtocolChoices(')[1]?.slice(0, 450) || '';
    expect(protoChoicesBlock).toContain('"wireguard"');
    expect(protoChoicesBlock).toContain('"amneziawg"');
    expect(protoChoicesBlock).toContain('"warp"');

    // Pack 4: Pre-save subscription preview (editor_preview)
    expect(sectionJs).toContain('Preview subscription servers');
    expect(sectionJs).toContain('/var/run/forkop/ui-state/');
    expect(sectionJs).toContain('"editor_preview"');

    // Pack 1: WG/AWG .conf import & 1-sided AWG & Cloudflare WARP profile generator
    expect(sectionJs).toContain('Import WireGuard / AmneziaWG / Generate WARP');
    expect(sectionJs).toContain(
      'Enable 1-sided AmneziaWG obfuscation (Jc=4, Jmin=40, Jmax=70)',
    );
    expect(sectionJs).toContain('"generate_warp_profile"');
  });

  it('groups _subscription_preview, _wg_warp_helper, and console_mode cleanly in formGuide', () => {
    const scope = document.createElement('div');
    scope.className = 'fkp-workspace-modal';
    const tab = document.createElement('div');
    tab.dataset.tab = 'settings';
    for (const key of [
      'enabled',
      'action',
      'selector_proxy_links',
      '_wg_warp_helper',
      'subscription_url',
      '_subscription_preview',
      'console_mode',
    ]) {
      const row = document.createElement('div');
      row.className = 'cbi-value';
      row.id = `cbi-forkop-main-${key}`;
      tab.append(row);
    }
    scope.append(tab);
    enhanceForkopForms(scope);

    const groups = [...tab.querySelectorAll('.fkp-form-group')];
    const sourcesGroup = groups.find((g) =>
      g.textContent?.includes('Источники подключения'),
    )!;
    expect(
      sourcesGroup.querySelector('#cbi-forkop-main-_wg_warp_helper'),
    ).not.toBeNull();
    expect(
      sourcesGroup.querySelector('#cbi-forkop-main-_subscription_preview'),
    ).not.toBeNull();

    const advancedGroup = groups.find((g) =>
      g.textContent?.includes('дополнительные параметры'),
    )!;
    expect(
      advancedGroup.querySelector('#cbi-forkop-main-console_mode'),
    ).not.toBeNull();
  });

  it('executes pre-save editor_preview and WG/AWG .conf + WARP generator behaviorally in section.js', async () => {
    const sectionJs = fs.readFileSync(
      path.join(luciForkopDir, 'section.js'),
      'utf8',
    );
    const block = sectionJs.match(
      /\/\/ Tier-2 native helpers begin[\s\S]*?\/\/ Tier-2 native helpers end/,
    );
    expect(block).not.toBeNull();

    const makeE = (
      tag: string,
      attrs?: Record<string, unknown> | unknown,
      children?: unknown,
    ): HTMLElement => {
      const el = document.createElement(tag);
      const attrObj =
        attrs &&
        typeof attrs === 'object' &&
        !Array.isArray(attrs) &&
        !(attrs instanceof Node)
          ? (attrs as Record<string, unknown>)
          : {};
      const actualChildren =
        attrs instanceof Node ||
        Array.isArray(attrs) ||
        typeof attrs === 'string'
          ? attrs
          : children;
      for (const [k, v] of Object.entries(attrObj)) {
        if (k === 'click' && typeof v === 'function') {
          el.addEventListener('click', v as EventListener);
        } else if (k === 'class') {
          el.className = String(v);
        } else if (v !== null && v !== undefined) {
          el.setAttribute(k, String(v));
        }
      }
      const appendItem = (c: unknown) => {
        if (c == null || c === false) return;
        if (Array.isArray(c)) c.forEach(appendItem);
        else if (c instanceof Node) el.appendChild(c);
        else el.appendChild(document.createTextNode(String(c)));
      };
      appendItem(actualChildren);
      return el;
    };

    const writtenFiles: Array<[string, string]> = [];
    const execCalls: Array<[string, string[]]> = [];
    const addedLinks: string[] = [];
    let refreshedSection = '';

    const previewCache = new Map();
    const choicesCache = new Map();
    const mockFs = {
      write: async (filePath: string, data: string) => {
        writtenFiles.push([filePath, data]);
      },
      exec: async (cmd: string, args: string[]) => {
        execCalls.push([cmd, args]);
        if (args[0] === 'editor_preview') {
          return {
            code: 0,
            stdout: JSON.stringify({
              success: true,
              names: ['DE Frankfurt 01', 'NL Amsterdam 02'],
              countries: { 'DE Frankfurt 01': 'de', 'NL Amsterdam 02': 'nl' },
              count: 2,
            }),
            stderr: '',
          };
        }
        if (args[0] === 'generate_warp_profile') {
          return {
            code: 0,
            stdout: JSON.stringify({
              success: true,
              data: {
                link: `warp://${encodeURIComponent(WG_PRIV_SLASH_PLUS)}@engage.cloudflareclient.com:2408?publickey=${encodeURIComponent(WG_PUB_SLASH_PLUS)}&address=172.16.0.2/32&jc=4&jmin=40&jmax=70#Cloudflare-WARP`,
                endpoint: { host: 'engage.cloudflareclient.com', port: 2408 },
              },
            }),
            stderr: '',
          };
        }
        return { code: 1, stdout: '', stderr: 'unexpected' };
      },
    };

    const mockUci = {
      get: (_pkg: string, _sid: string, opt?: string) =>
        opt === 'detect_server_country' ? 'country_is' : '',
      set: (_pkg: string, _sid: string, opt: string, val: string[]) => {
        if (opt === 'selector_proxy_links') {
          addedLinks.push(...val);
        }
      },
      sections: () => [
        {
          '.name': 'bootstrap_vpn',
          label: 'Bootstrap VPN',
          enabled: '1',
          mixed_proxy_enabled: '1',
          mixed_proxy_port: '2080',
        },
      ],
    };

    const buildApi = new Function(
      'E',
      '_',
      'fs',
      'uci',
      'ui',
      'main',
      'UCI_PACKAGE',
      'subscriptionPreviewCache',
      'outboundNameChoicesCache',
      'subscriptionUrlSourceOption',
      'currentLiveDynamicListValues',
      'normalizeDynamicListItems',
      'getChildItemIds',
      'isExistingChildItem',
      'childItemInputValue',
      'readChildSettings',
      'subscriptionUrlSettingsKeys',
      'defaultSubscriptionUrlSettings',
      'currentSourceOptionValues',
      'plainObject',
      'refreshDashboardFilterChoiceWidgets',
      'getConfigListValues',
      `${block![0]}\nreturn { renderSubscriptionPreviewToolbar, parseWgAwgIniToLink, openWgWarpHelperModal };`,
    );

    const api = buildApi(
      makeE,
      (s: string) => s,
      mockFs,
      mockUci,
      {
        showModal: (_title: string, nodes: Node[]) => {
          const host = document.createElement('div');
          host.dataset.modalHost = '';
          nodes.forEach((n) => host.appendChild(n));
          document.body.appendChild(host);
        },
        hideModal: () => {},
      },
      { validateProxyUrl, showToast: () => {} },
      'forkop',
      previewCache,
      choicesCache,
      null,
      (_sid: string, opt: string) =>
        opt === 'subscription_url' ? ['https://sub.example.com/api/v1'] : null,
      (v: unknown) => (Array.isArray(v) ? v : v ? [String(v)] : []),
      () => [],
      () => false,
      (_sid: string, item: string) => item,
      () => ({}),
      () => [],
      () => ({
        auto_hwid: '1',
        auto_user_agent: '1',
        prefix_nodes: '0',
        download_via_proxy_enabled: '0',
        include_urltest_groups: '1',
        hide_urltest_group_outbounds: '1',
        hide_detour_outbounds: '1',
      }),
      () => [],
      (o: unknown) => (o && typeof o === 'object' ? o : {}),
      (sid: string) => {
        refreshedSection = sid;
      },
      () => [],
    );

    // 1. Pre-save subscription preview
    const previewNode = api.renderSubscriptionPreviewToolbar(
      'main',
    ) as HTMLElement;
    document.body.appendChild(previewNode);
    previewNode.querySelector('button')!.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(writtenFiles.length).toBe(1);
    expect(writtenFiles[0][0]).toMatch(
      /^\/var\/run\/forkop\/ui-state\/editor-\d+-[a-z0-9]+\.json$/,
    );
    const writtenPayload = JSON.parse(writtenFiles[0][1]);
    expect(writtenPayload.section_id).toBe('main');
    expect(writtenPayload.sources[0]).toMatchObject({
      url: 'https://sub.example.com/api/v1',
      hwid_auto: true,
    });
    expect(choicesCache.get('main')).toEqual([
      'DE Frankfurt 01',
      'NL Amsterdam 02',
    ]);
    expect(refreshedSection).toBe('main');
    expect(previewNode.textContent).toContain('[DE] DE Frankfurt 01');

    // 2. WireGuard .conf -> 1-sided AmneziaWG share link
    const parsedIni = api.parseWgAwgIniToLink(
      `[Interface]\nPrivateKey = ${WG_PRIV_SLASH_PLUS}\nAddress = 10.66.66.2/32\n[Peer]\nPublicKey = ${WG_PUB_SLASH_PLUS}\nEndpoint = 198.51.100.10:51820\nAllowedIPs = 0.0.0.0/0`,
      'Router-AWG',
      true,
    );
    expect(parsedIni.valid).toBe(true);
    expect(parsedIni.link).toMatch(/^awg:\/\//);
    expect(parsedIni.link).toContain('jc=4');
    expect(parsedIni.link).toContain('jmin=40');
    expect(parsedIni.link).toContain('jmax=70');

    // 3. Cloudflare WARP generator modal execution
    api.openWgWarpHelperModal('main');
    const modalHost = document.querySelector('[data-modal-host]')!;
    const warpBtn = [...modalHost.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Generate Cloudflare WARP profile'),
    )!;
    warpBtn.click();
    await new Promise((r) => setTimeout(r, 0));

    const warpExec = execCalls.find(
      ([, args]) => args[0] === 'generate_warp_profile',
    );
    expect(warpExec).toBeDefined();
    expect(JSON.parse(warpExec![1][1])).toMatchObject({
      license_key: '',
      one_sided_awg: true,
      proxy_section: '',
    });
    expect(addedLinks.some((l) => l.startsWith('warp://'))).toBe(true);
  });
});
