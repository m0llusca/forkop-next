#!/usr/bin/env node
/**
 * Real headless Chromium CDP + OpenWrt 25.12.6 LuCI Bootstrap responsive & mobile audit
 * emulating ASUS TUF-AX4200 across 9 viewports (320px..1440px).
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const LUCI_ROOT =
  process.env.FORKOP_OPENWRT_LUCI_DIR ||
  (fs.existsSync('/tmp/openwrt-luci')
    ? '/tmp/openwrt-luci'
    : path.join(os.homedir(), '.cache/forkop-dev/openwrt-luci'));
const LUCI_BASE_RES = path.join(
  LUCI_ROOT,
  'modules/luci-base/htdocs/luci-static/resources',
);
const LUCI_BOOTSTRAP_MEDIA = path.join(
  LUCI_ROOT,
  'themes/luci-theme-bootstrap/htdocs/luci-static/bootstrap',
);
const FORKOP_HTDOCS = path.join(REPO_ROOT, 'luci-app-forkop/htdocs');
const PO2LMO = path.join(LUCI_ROOT, 'modules/luci-base/src/po2lmo');
const FORKOP_RU_PO = path.join(REPO_ROOT, 'luci-app-forkop/po/ru/forkop.po');
const CHROMIUM_BIN = '/usr/bin/chromium';

const VIEWPORTS = [
  { name: 'mobile-320x568', width: 320, height: 568, mobile: true },
  { name: 'mobile-360x800', width: 360, height: 800, mobile: true },
  { name: 'mobile-375x812', width: 375, height: 812, mobile: true },
  { name: 'mobile-390x844', width: 390, height: 844, mobile: true },
  { name: 'mobile-412x915', width: 412, height: 915, mobile: true },
  { name: 'tablet-720x1024', width: 720, height: 1024, mobile: true },
  { name: 'tablet-900x1024', width: 900, height: 1024, mobile: false },
  { name: 'desktop-1050x800', width: 1050, height: 800, mobile: false },
  { name: 'desktop-1440x900', width: 1440, height: 900, mobile: false },
];

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function compileTranslationsJs() {
  const tmpLmo = path.join(os.tmpdir(), `forkop-audit-${process.pid}.lmo`);
  execFileSync(PO2LMO, [FORKOP_RU_PO, tmpLmo]);
  const buf = fs.readFileSync(tmpLmo);
  fs.unlinkSync(tmpLmo);
  const tr = {};
  if (buf.length >= 4) {
    const idxOffset = buf.readUInt32BE(buf.length - 4);
    for (let pos = idxOffset; pos + 16 <= buf.length - 4; pos += 16) {
      const keyId = buf.readUInt32BE(pos);
      const offset = buf.readUInt32BE(pos + 8);
      const length = buf.readUInt32BE(pos + 12);
      if (offset + length <= idxOffset) {
        tr[keyId.toString(16).padStart(8, '0')] = buf
          .subarray(offset, offset + length)
          .toString('utf8');
      }
    }
  }
  return `window.TR=${JSON.stringify(tr)};`;
}

function buildMockUciValues() {
  return {
    settings: {
      '.anonymous': false,
      '.type': 'settings',
      '.name': 'settings',
      '.index': 0,
      dns_type: 'doh',
      dns_server: 'https://cloudflare-dns.com/dns-query',
      bootstrap_dns_server: '1.1.1.1',
      config_path: '/etc/sing-box/config.json',
      cache_path: '/tmp/sing-box/cache.db',
      enable_yacd: '1',
      https_domain_routing: '1',
      bittorrent_direct: '1',
      torrserver_direct: '1',
      disable_quic: '1',
      exclude_ntp: '1',
    },
    main: {
      '.anonymous': false,
      '.type': 'section',
      '.name': 'main',
      '.index': 1,
      label: 'Основной маршрут для стриминга и облачных сервисов',
      enabled: '1',
      action: 'connection',
      domain_suffix: ['youtube.com', 'googlevideo.com', 'openai.com'],
      connections: ['sub_main', 'ut_eu'],
      subscription_url: ['sub_main'],
      urltest_groups: ['ut_eu'],
      selector_proxy_links: [
        'vless://11111111-1111-1111-1111-111111111111@nl-amsterdam-edge-very-long-hostname-01.example.com:443?security=reality&sni=www.microsoft.com&pbk=n2-7B7P1w5N8vK6mX9zQ3rT4yU8iO0pA2sD4fG6hJ1k#NL-Amsterdam-Ultra-Long-Node-Name-REALITY-XHTTP',
      ],
      mixed_proxy_enabled: '1',
      mixed_proxy_port: '2080',
    },
    sub_main: {
      '.anonymous': false,
      '.type': 'subscription_url',
      '.name': 'sub_main',
      '.index': 2,
      section: 'main',
      url: 'https://subscriptions-provider-edge-cdn.example.org/api/v1/client/subscribe?token=very_long_subscription_identifier_12345',
    },
    ut_eu: {
      '.anonymous': false,
      '.type': 'urltest',
      '.name': 'ut_eu',
      '.index': 3,
      section: 'main',
      name: 'Fastest-Europe-Cluster-With-Very-Long-Group-Label',
      testing_url: 'https://www.gstatic.com/generate_204',
      check_interval: '3m',
      tolerance: '50',
      pin_dashboard: '1',
    },
    ps5_rule: {
      '.anonymous': false,
      '.type': 'section',
      '.name': 'ps5_rule',
      '.index': 4,
      label: 'Игровая консоль PlayStation 5 (временное правило)',
      enabled: '1',
      action: 'connection',
      console_mode: '1',
      next_target: 'main',
      next_expires: '4102444800',
      fully_routed_ips: ['192.168.1.55/32'],
    },
    home_vless: {
      '.anonymous': false,
      '.type': 'server',
      '.name': 'home_vless',
      '.index': 5,
      label: 'Входящий сервер ASUS-TUF-AX4200-VLESS-REALITY-Home',
      enabled: '1',
      protocol: 'vless',
      listen: '0.0.0.0',
      listen_port: '8443',
      public_host: 'router-home-extremely-long-ddns-hostname.example.net',
      reality_server_name: 'www.cloudflare.com',
      reality_public_key: 'n2-7B7P1w5N8vK6mX9zQ3rT4yU8iO0pA2sD4fG6hJ1k',
      reality_short_id: '0123456789abcdef',
      users_json:
        '[{"name":"iphone-mobile-client-with-extremely-long-identifier","uuid":"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"}]',
    },
  };
}

function handleForkopCommand(args) {
  const cmd = args[0] || '';
  const systemInfo = {
    forkop_version: '1.2.1-r2',
    forkop_latest_version: '1.2.1-r2',
    luci_app_version: '1.2.1-r2',
    sing_box_version: '1.14.3-extended-2.7.3',
    sing_box_extended: 1,
    sing_box_tiny: 0,
    sing_box_tailscale: 1,
    zapret_installed: 1,
    zapret_version: '72.20260301',
    zapret2_installed: 0,
    zapret2_version: 'not installed',
    byedpi_installed: 1,
    byedpi_version: '0.17.3',
    openwrt_version: 'OpenWrt 25.12.6 r33311-981c978eff (mediatek/filogic)',
    device_model: 'ASUS TUF-AX4200 (MediaTek MT7986A Filogic 830)',
    server_inbounds_enabled_count: 1,
  };
  const statusData = {
    enabled: 1,
    active: 1,
    running: 1,
    status: 'running',
    sing_box_running: 1,
    dns_configured: 1,
    nft_configured: 1,
  };

  switch (cmd) {
    case 'get_ui_capabilities':
      return { code: 0, stdout: JSON.stringify(systemInfo) };
    case 'get_ui_state':
      return {
        code: 0,
        stdout: JSON.stringify({
          service: {
            forkop: {
              running: 1,
              enabled: 1,
              status: 'running & enabled',
            },
            sing_box: {
              running: 1,
              enabled: 1,
            },
          },
          capabilities: systemInfo,
          actions: {
            subscription: [],
            latency: [],
            component: [],
            service: [],
          },
          status: statusData,
          sing_box_status: { running: 1, enabled: 1, active: 1 },
          system_info: systemInfo,
          component_updates: {
            checked_at: Math.floor(Date.now() / 1000),
            components: {
              forkop: {
                component: 'forkop',
                status: 'latest',
                current_version: '1.2.1-r2',
                latest_version: '1.2.1-r2',
                release_url:
                  'https://github.com/m0llusca/forkop-next/releases/tag/v1.2.1-r2',
              },
              'sing-box': {
                component: 'sing-box',
                status: 'outdated',
                current_version: '1.14.3-extended-2.7.3',
                latest_version: '1.14.4-extended-2.7.4-aarch64_cortex-a53',
                release_url:
                  'https://github.com/SagerNet/sing-box/releases/tag/v1.14.4',
              },
            },
          },
        }),
      };
    case 'get_status':
      return { code: 0, stdout: JSON.stringify(statusData) };
    case 'get_sing_box_status':
      return { code: 0, stdout: JSON.stringify({ running: 1, enabled: 1 }) };
    case 'get_system_info':
      return { code: 0, stdout: JSON.stringify(systemInfo) };
    case 'check_nft':
      return { code: 0, stdout: JSON.stringify({ configured: 1, rules_present: 1 }) };
    case 'check_dns_available':
      return { code: 0, stdout: JSON.stringify({ dns_available: 1, local_dns_working: 1 }) };
    case 'check_sing_box':
      return { code: 0, stdout: JSON.stringify({ valid: 1, running: 1 }) };
    case 'get_ActionProviders_status':
    case 'get_action_providers_status':
      return { code: 0, stdout: JSON.stringify(systemInfo) };
    case 'component_impact':
      return {
        code: 0,
        stdout: JSON.stringify({
          success: true,
          component: args[1] || 'sing-box',
          action: args[2] || 'install',
          will_restart_forkop: true,
          will_reload_sing_box: true,
          affected_sections: [
            'main (Основной маршрут для стриминга и облачных сервисов / nl-amsterdam-edge-very-long-hostname-01.example.com)',
          ],
          warnings: [
            'Установка пакета sing-box-extended_1.14.4-extended-2.7.4_aarch64_cortex-a53.apk временно перезапустит туннели.',
          ],
        }),
      };
    case 'dashboard_batch':
    case 'get_dashboard_sections':
      return {
        code: 0,
        stdout: JSON.stringify({
          sections: [
            {
              name: 'main',
              label: 'Основной маршрут для стриминга и облачных сервисов',
              action: 'connection',
              activeOutbound:
                'NL-Amsterdam-Ultra-Long-Node-Name-REALITY-XHTTP',
              subscriptions: [
                {
                  url: 'https://subscriptions-provider-edge-cdn.example.org/api/v1/client/subscribe',
                  title:
                    'Подписка Europe-Cloud-Cluster-Ultra-Long-Subscription-Provider-Title',
                  upload: 1073741824,
                  download: 21474836480,
                  total: 107374182400,
                  expire: 1893456000,
                  updatedAt: Math.floor(Date.now() / 1000) - 300,
                },
              ],
              outbounds: [
                {
                  tag: 'ut_eu-urltest',
                  displayName:
                    'Fastest-Europe-Cluster-With-Very-Long-Group-Label',
                  type: 'urltest',
                  selected: true,
                  latency: 28,
                  members: [
                    {
                      tag: 'NL-Amsterdam-Ultra-Long-Node-Name-REALITY-XHTTP',
                      displayName:
                        'NL-Amsterdam-Ultra-Long-Node-Name-REALITY-XHTTP-2026-Edge',
                      protocol: 'vless',
                      transport: 'xhttp',
                      security: 'reality',
                      latency: 28,
                      selected: true,
                      shareLink:
                        'vless://11111111-1111-1111-1111-111111111111@nl-edge.example.com:443#NL',
                    },
                    {
                      tag: 'DE-Frankfurt-Backup-Node-With-Very-Long-Tag',
                      displayName:
                        'DE-Frankfurt-Backup-Node-With-Very-Long-Tag-TLS',
                      protocol: 'trojan',
                      transport: 'ws',
                      security: 'tls',
                      latency: 44,
                      selected: false,
                      shareLink: 'trojan://pass@de-edge.example.com:443#DE',
                    },
                  ],
                },
                {
                  tag: 'NL-Amsterdam-Ultra-Long-Node-Name-REALITY-XHTTP',
                  displayName:
                    'NL-Amsterdam-Ultra-Long-Node-Name-REALITY-XHTTP',
                  type: 'vless',
                  protocol: 'vless',
                  transport: 'xhttp',
                  security: 'reality',
                  selected: false,
                  latency: 28,
                  shareLink:
                    'vless://11111111-1111-1111-1111-111111111111@nl-edge.example.com:443#NL',
                },
              ],
            },
          ],
        }),
      };
    case 'clash_api': {
      const sub = args[1] || '';
      if (sub === 'get_proxies') {
        return {
          code: 0,
          stdout: JSON.stringify({
            proxies: {
              'main-out': {
                name: 'main-out',
                type: 'Selector',
                now: 'ut_eu-urltest',
                all: [
                  'ut_eu-urltest',
                  'NL-Amsterdam-Ultra-Long-Node-Name-REALITY-XHTTP',
                ],
              },
              'ut_eu-urltest': {
                name: 'ut_eu-urltest',
                type: 'URLTest',
                now: 'NL-Amsterdam-Ultra-Long-Node-Name-REALITY-XHTTP',
                all: [
                  'NL-Amsterdam-Ultra-Long-Node-Name-REALITY-XHTTP',
                  'DE-Frankfurt-Backup-Node-With-Very-Long-Tag',
                ],
              },
              'NL-Amsterdam-Ultra-Long-Node-Name-REALITY-XHTTP': {
                name: 'NL-Amsterdam-Ultra-Long-Node-Name-REALITY-XHTTP',
                type: 'VLESS',
                history: [{ delay: 28 }],
              },
              'DE-Frankfurt-Backup-Node-With-Very-Long-Tag': {
                name: 'DE-Frankfurt-Backup-Node-With-Very-Long-Tag',
                type: 'Trojan',
                history: [{ delay: 44 }],
              },
            },
          }),
        };
      }
      if (sub === 'get_connections') {
        return {
          code: 0,
          stdout: JSON.stringify({
            downloadTotal: 987654321,
            uploadTotal: 123456789,
            connections: [
              {
                id: 'conn-1',
                upload: 204800,
                download: 10485760,
                start: new Date(Date.now() - 65000).toISOString(),
                chains: [
                  'NL-Amsterdam-Ultra-Long-Node-Name-REALITY-XHTTP',
                  'main-out',
                ],
                rule: 'domain_suffix=[googlevideo.com,youtube.com]',
                rulePayload: '',
                metadata: {
                  network: 'tcp',
                  type: 'tproxy',
                  sourceIP: '2001:db8:4200:1:abcd:ef01:2345:6789',
                  destinationIP: '2607:f8b0:4006:81c::200e',
                  sourcePort: '54321',
                  destinationPort: '443',
                  host: 'rr4---sn-4g5ednsd-extremely-long-googlevideo-edge-cluster-node.googlevideo.com',
                  dnsMode: 'normal',
                },
              },
            ],
          }),
        };
      }
      return { code: 0, stdout: '{}' };
    }
    case 'next_overview':
      return {
        code: 0,
        stdout: JSON.stringify({
          success: true,
          data: {
            service: { running: true, status: 'running' },
            summary: { rules_total: 2, rules_enabled: 2, servers_enabled: 1 },
            temporary_rules: [
              {
                section: 'ps5_rule',
                label: 'Игровая консоль PlayStation 5',
                target: 'main',
                expires: 4102444800,
              },
            ],
          },
        }),
      };
    case 'inbounds_config':
      return {
        code: 0,
        stdout: JSON.stringify({
          success: true,
          data: {
            enabled_count: 1,
            inbounds: [
              {
                section: 'home_vless',
                label: 'Входящий сервер ASUS-TUF-AX4200-VLESS-REALITY-Home',
                protocol: 'vless',
                enabled: true,
                port: 8443,
              },
            ],
          },
        }),
      };
    case 'local_devices':
      return {
        code: 0,
        stdout: JSON.stringify({
          success: true,
          data: {
            devices: [
              {
                ip: '192.168.1.55',
                mac: 'AA:BB:CC:DD:EE:55',
                hostname: 'PlayStation-5-LivingRoom-MediaTek-WiFi6',
                source: 'dhcp',
              },
              {
                ip: '192.168.1.88',
                mac: 'AA:BB:CC:DD:EE:88',
                hostname: 'iPhone-16-Pro-Max-Very-Long-Client-Hostname',
                source: 'arp',
              },
            ],
          },
        }),
      };
    case 'editor_preview':
      return {
        code: 0,
        stdout: JSON.stringify({
          success: true,
          count: 8,
          names: [
            'DE Frankfurt 01',
            'DE Berlin 02',
            'NL Amsterdam 01',
            'NL Rotterdam 02',
            'FI Helsinki 01',
            'US New York 01',
            'SG Singapore 01',
            'JP Tokyo 01',
          ],
          countries: {
            'DE Frankfurt 01': 'de',
            'DE Berlin 02': 'de',
            'NL Amsterdam 01': 'nl',
            'NL Rotterdam 02': 'nl',
            'FI Helsinki 01': 'fi',
            'US New York 01': 'us',
            'SG Singapore 01': 'sg',
            'JP Tokyo 01': 'jp',
          },
        }),
      };
    case 'tspu_classify':
      return {
        code: 0,
        stdout: JSON.stringify({
          success: true,
          data: {
            verdict: 'tspu_byte_cap_16kb',
            stages: [
              { stage: 'dns', status: 'ok', remote_ip: '142.250.74.110', duration_ms: 14 },
              { stage: 'tcp', status: 'ok', duration_ms: 21 },
              { stage: 'tls', status: 'ok', duration_ms: 36 },
              { stage: 'byte_cap', status: 'failed', bytes_read: 16384, duration_ms: 4100 },
            ],
            comparison: {
              section: 'main',
              bypass_verified: true,
              verdict: 'ok',
            },
          },
        }),
      };
    case 'next': {
      const subCmd = args[1] || '';
      if (subCmd === 'status') {
        return {
          code: 0,
          stdout: JSON.stringify({
            success: true,
            data: {
              service: { running: true, status: 'running' },
              sections: [
                {
                  name: 'main',
                  label: 'Основной маршрут для стриминга и облачных сервисов',
                  action: 'connection',
                },
              ],
            },
          }),
        };
      }
      if (subCmd === 'devices') {
        return {
          code: 0,
          stdout: JSON.stringify({
            success: true,
            data: {
              items: [
                {
                  ip: '192.168.1.55',
                  name: 'PlayStation-5-LivingRoom',
                  section: 'ps5_rule',
                },
              ],
              sections: [
                {
                  name: 'main',
                  label: 'Основной маршрут для стриминга и облачных сервисов',
                  action: 'connection',
                },
              ],
            },
          }),
        };
      }
      return { code: 0, stdout: JSON.stringify({ success: true, data: { items: [], sections: [] } }) };
    }
    default:
      return { code: 0, stdout: JSON.stringify({ success: true, data: {} }) };
  }
}

function handleUbusItem(item, uciValues) {
  const { id, method, params } = item;
  if (method !== 'call' || !Array.isArray(params)) {
    return { jsonrpc: '2.0', id, result: [0, {}] };
  }
  const [, obj, fn, args = {}] = params;
  if (obj === 'uci') {
    if (fn === 'get') {
      if (args.config === 'forkop') {
        return { jsonrpc: '2.0', id, result: [0, { values: uciValues }] };
      }
      if (args.config === 'dhcp' || args.config === 'network') {
        return { jsonrpc: '2.0', id, result: [0, { values: {} }] };
      }
      return { jsonrpc: '2.0', id, result: [0, { values: {} }] };
    }
    if (fn === 'changes') {
      return { jsonrpc: '2.0', id, result: [0, { changes: {} }] };
    }
    return { jsonrpc: '2.0', id, result: [0, {}] };
  }
  if (obj === 'file') {
    if (fn === 'exec') {
      const cmd = args.command || '';
      const cmdArgs = Array.isArray(args.params) ? args.params : [];
      if (cmd.endsWith('forkop')) {
        return { jsonrpc: '2.0', id, result: [0, handleForkopCommand(cmdArgs)] };
      }
      return { jsonrpc: '2.0', id, result: [0, { code: 0, stdout: '{}' }] };
    }
    if (fn === 'write' || fn === 'remove') {
      return { jsonrpc: '2.0', id, result: [0] };
    }
    if (fn === 'read') {
      return { jsonrpc: '2.0', id, result: [0, { data: '' }] };
    }
    if (fn === 'stat' || fn === 'list') {
      return { jsonrpc: '2.0', id, result: [0, { entries: [] }] };
    }
  }
  if (obj === 'luci' && fn === 'getInitList') {
    return {
      jsonrpc: '2.0',
      id,
      result: [0, { forkop: { enabled: true, running: true } }],
    };
  }
  if (obj === 'network.interface' && fn === 'dump') {
    return {
      jsonrpc: '2.0',
      id,
      result: [
        0,
        {
          interface: [
            { interface: 'lan', l3_device: 'br-lan', up: true },
            { interface: 'wan', l3_device: 'eth1', up: true },
          ],
        },
      ],
    };
  }
  if (obj === 'session' && fn === 'access') {
    return { jsonrpc: '2.0', id, result: [0, { access: true }] };
  }
  return { jsonrpc: '2.0', id, result: [0, {}] };
}

function renderIndexHtml() {
  const env = {
    media: '/luci-static/bootstrap',
    resource: '/luci-static/resources',
    scriptname: '/cgi-bin/luci',
    pathinfo: '/admin/services/forkop',
    documentroot: '/www',
    requestpath: ['admin', 'services', 'forkop'],
    dispatchpath: ['admin', 'services', 'forkop'],
    pollinterval: 60,
    ubuspath: '/ubus/',
    sessionid: '0123456789abcdef0123456789abcdef',
    token: 'deadbeef',
    nodespec: {
      title: 'Forkop',
      action: { type: 'view', path: 'forkop/forkop' },
      satisfied: true,
    },
    apply_rollback: 90,
    apply_holdoff: 4,
    apply_timeout: 5,
    apply_display: 1.5,
    rollback_token: 'rb1',
  };
  return `<!DOCTYPE html>
<html lang="ru" data-darkmode="false">
<head>
  <meta charset="utf-8">
  <title>TUF-AX4200 - Forkop - LuCI</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/luci-static/bootstrap/cascade.css">
  <link rel="stylesheet" media="only screen and (max-device-width: 854px)" href="/luci-static/bootstrap/mobile.css">
  <script src="/cgi-bin/luci/admin/translations/ru"></script>
  <script src="/luci-static/resources/cbi.js"></script>
  <script src="/luci-static/resources/luci.js"></script>
  <script>
    window.L = new LuCI(${JSON.stringify(env)});
  </script>
</head>
<body class="lang_ru Forkop" data-page="admin-services-forkop">
  <header>
    <a class="brand" href="/">TUF-AX4200</a>
    <ul class="nav" id="topmenu"></ul>
    <div id="indicators" class="pull-right"></div>
  </header>
  <div id="maincontent" class="container">
    <div id="tabmenu" style="display:none"></div>
    <div id="view">
      <div class="spinning">Загрузка…</div>
    </div>
  </div>
  <script>
    L.require('ui').then(function(ui) {
      return ui.instantiateView('forkop/forkop');
    }).then(function() {
      window.__FORKOP_VIEW_READY__ = true;
    }).catch(function(err) {
      window.__FORKOP_VIEW_ERROR__ = String(err && err.stack || err);
      console.error(err);
    });
  </script>
</body>
</html>`;
}

function mimeType(filePath) {
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function startLuciServer(port) {
  const translationsJs = compileTranslationsJs();
  const uciValues = buildMockUciValues();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (req.method === 'POST' && url.pathname.startsWith('/ubus')) {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        const parsed = JSON.parse(body || '[]');
        const reply = Array.isArray(parsed)
          ? parsed.map((item) => handleUbusItem(item, uciValues))
          : handleUbusItem(parsed, uciValues);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(reply));
      });
      return;
    }

    if (url.pathname === '/' || url.pathname === '/cgi-bin/luci/admin/services/forkop') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderIndexHtml());
      return;
    }

    if (url.pathname === '/cgi-bin/luci/admin/translations/ru') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(translationsJs);
      return;
    }

    if (url.pathname.startsWith('/luci-static/bootstrap/')) {
      const rel = url.pathname.slice('/luci-static/bootstrap/'.length);
      const target = path.join(LUCI_BOOTSTRAP_MEDIA, rel);
      if (fs.existsSync(target) && fs.statSync(target).isFile()) {
        res.writeHead(200, { 'Content-Type': mimeType(target) });
        res.end(fs.readFileSync(target));
        return;
      }
    }

    if (url.pathname.startsWith('/luci-static/resources/')) {
      const rel = url.pathname.slice('/luci-static/resources/'.length);
      const forkopTarget = path.join(FORKOP_HTDOCS, 'luci-static/resources', rel);
      const baseTarget = path.join(LUCI_BASE_RES, rel);
      const target = fs.existsSync(forkopTarget) ? forkopTarget : baseTarget;
      if (fs.existsSync(target) && fs.statSync(target).isFile()) {
        res.writeHead(200, { 'Content-Type': mimeType(target) });
        res.end(fs.readFileSync(target));
        return;
      }
    }

    res.writeHead(404);
    res.end('Not found');
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(
        `Browser eval failed: ${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description || ''}`,
      );
    }
    return res.result.value;
  }

  close() {
    this.ws?.close();
  }
}

async function launchChromium(debugPort) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fkp-chromium-'));
  const env = { ...process.env };
  delete env.HTTP_PROXY;
  delete env.HTTPS_PROXY;
  delete env.http_proxy;
  delete env.https_proxy;

  const proc = spawn(
    CHROMIUM_BIN,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      `--user-data-dir=${userDataDir}`,
      `--remote-debugging-port=${debugPort}`,
      'about:blank',
    ],
    { env, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let pageWsUrl = null;
  for (let i = 0; i < 60; i++) {
    try {
      const resp = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      if (resp.ok) {
        const targets = await resp.json();
        const page = targets.find((t) => t.type === 'page');
        if (page?.webSocketDebuggerUrl) {
          pageWsUrl = page.webSocketDebuggerUrl;
          break;
        }
      }
    } catch {
      // wait
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!pageWsUrl) {
    proc.kill('SIGKILL');
    throw new Error('Failed to connect to headless Chromium CDP');
  }

  return {
    proc,
    pageWsUrl,
    cleanup: async () => {
      if (proc.exitCode === null) {
        const exited = new Promise((resolve) => proc.once('exit', resolve));
        proc.kill('SIGKILL');
        await Promise.race([exited, new Promise((r) => setTimeout(r, 1500))]);
      }
      fs.rmSync(userDataDir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
    },
  };
}

async function auditViewport(cdp, baseUrl, vp) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: vp.mobile ? 2 : 1,
    mobile: vp.mobile,
  });
  await cdp.send('Page.navigate', {
    url: `${baseUrl}/cgi-bin/luci/admin/services/forkop`,
  });

  await cdp.evaluate(`
    new Promise((resolve, reject) => {
      const deadline = Date.now() + 15000;
      const tick = () => {
        if (window.__FORKOP_VIEW_ERROR__) return reject(new Error(window.__FORKOP_VIEW_ERROR__));
        if (window.__FORKOP_VIEW_READY__ && document.querySelector('.fkp-workspace')) {
          return setTimeout(resolve, 250);
        }
        if (Date.now() > deadline) return reject(new Error('Timed out waiting for Forkop workspace'));
        setTimeout(tick, 50);
      };
      tick();
    })
  `);

  const issues = await cdp.evaluate(`
    (async () => {
      const vpWidth = window.innerWidth;
      const vpHeight = window.innerHeight;
      const isMobile = vpWidth <= 720;
      const issues = [];
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));

      const checkOverflowAndTargets = (contextName) => {
        const docScrollW = document.documentElement.scrollWidth;
        if (docScrollW > vpWidth + 1) {
          issues.push(\`[\${contextName}] Document horizontal overflow: scrollWidth=\${docScrollW} > innerWidth=\${vpWidth}\`);
        }

        const ws = document.querySelector('.fkp-workspace');
        const main = document.querySelector('.fkp-workspace-main');
        if (ws && main) {
          const mainRect = main.getBoundingClientRect();
          if (isMobile && mainRect.width < vpWidth * 0.72) {
            issues.push(\`[\${contextName}] Mobile workspace main column crushed: width=\${Math.round(mainRect.width)} at viewport=\${vpWidth}\`);
          }
          if (!isMobile && vpWidth >= 1200) {
            const wsOverflow = getComputedStyle(ws).overflow;
            if (wsOverflow.includes('clip') || wsOverflow.includes('hidden')) {
              issues.push(\`[\${contextName}] Desktop .fkp-workspace overflow=\${wsOverflow} breaks sticky sidebar\`);
            }
          }

          // Check visible blocks inside main for horizontal overflow
          for (const el of main.querySelectorAll('.fkp-next, .cbi-section, .fkp_dashboard-page__section, .fkp_monitoring-page, .fkp_diagnostic-page, .fkp_updates-page')) {
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (r.right > vpWidth + 2 || r.left < -2) {
              issues.push(\`[\${contextName}] Element <\${el.tagName.toLowerCase()} class="\${el.className}"> overflows viewport (\${Math.round(r.left)}..\${Math.round(r.right)} vs 0..\${vpWidth})\`);
            }
          }
        }

        // Check nav & disclosure >= 44px
        for (const el of document.querySelectorAll('.fkp-workspace-nav-button, .fkp-workspace-mobile-menu select, .fkp-workspace summary')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.height < 43.5) {
            issues.push(\`[\${contextName}] Nav/disclosure target <44px (\${r.height.toFixed(1)}px): \${el.tagName.toLowerCase()}.\${el.className}\`);
          }
        }

        // Open visible non-block .fkp-action-menu dropdowns one-by-one and verify popover stays within viewport
        for (const menu of document.querySelectorAll('.fkp-workspace details.fkp-action-menu:not(.fkp-action-menu--block)')) {
          if (menu.hidden) continue;
          const mr = menu.getBoundingClientRect();
          if (mr.width === 0 && mr.height === 0) continue;
          const wasOpen = menu.open;
          menu.open = true;
          menu.dispatchEvent(new Event('toggle'));
          const pop = menu.querySelector('.fkp-action-menu__popover');
          if (pop) {
            const pr = pop.getBoundingClientRect();
            if (pr.width > 0 && (pr.left < -1 || pr.right > vpWidth + 1)) {
              issues.push(\`[\${contextName}] Open .fkp-action-menu__popover overflows viewport (\${Math.round(pr.left)}..\${Math.round(pr.right)} vs 0..\${vpWidth})\`);
            }
          }
          menu.open = wasOpen;
        }
      };

      const parseRgb = (cssColor) => {
        const m = String(cssColor || '').match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
      };
      const luminance = ([r, g, b]) => {
        const chan = (v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
      };
      const contrastRatio = (fgCss, bgCss) => {
        const fg = parseRgb(fgCss);
        const bg = parseRgb(bgCss);
        if (!fg || !bg) return 21;
        const l1 = luminance(fg);
        const l2 = luminance(bg);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };

      const checkAccessibilityAndContrast = (themeLabel) => {
        const ws = document.querySelector('.fkp-workspace');
        if (!ws) return;
        const wsStyle = getComputedStyle(ws);
        const baseRatio = contrastRatio(wsStyle.color, wsStyle.backgroundColor);
        if (baseRatio < 4.5) {
          issues.push(\`[contrast-\${themeLabel}] Workspace text contrast \${baseRatio.toFixed(2)}:1 < 4.5:1\`);
        }
        const card = document.querySelector('.fkp-scenario-card');
        if (card) {
          const cardBg = getComputedStyle(card).backgroundColor;
          const titleEl = card.querySelector('.fkp-scenario-title');
          const descEl = card.querySelector('.fkp-scenario-desc');
          if (titleEl) {
            const tr = contrastRatio(getComputedStyle(titleEl).color, cardBg);
            if (tr < 4.5) {
              issues.push(\`[contrast-\${themeLabel}] Scenario title contrast \${tr.toFixed(2)}:1 < 4.5:1\`);
            }
          }
          if (descEl) {
            const dr = contrastRatio(getComputedStyle(descEl).color, cardBg);
            if (dr < 4.5) {
              issues.push(\`[contrast-\${themeLabel}] Scenario description contrast \${dr.toFixed(2)}:1 < 4.5:1\`);
            }
          }
        }
        if (!document.querySelector('.fkp-workspace-primary')?.getAttribute('aria-label')) {
          issues.push('[a11y] Missing aria-label on .fkp-workspace-primary');
        }
        if (!document.querySelector('.fkp-workspace-mobile-menu select')?.getAttribute('aria-label')) {
          issues.push('[a11y] Missing aria-label on mobile section select');
        }
      };

      const selectArea = async (area) => {
        if (isMobile) {
          const sel = document.querySelector('.fkp-workspace-mobile-menu select');
          if (sel) {
            sel.value = area;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            issues.push(\`[nav] Missing .fkp-workspace-mobile-menu select for area=\${area}\`);
          }
        } else {
          const btn = document.querySelector(\`.fkp-workspace-nav-button[data-workspace-section="\${area}"]\`);
          if (btn) {
            btn.click();
          } else {
            issues.push(\`[nav] Missing .fkp-workspace-nav-button[data-workspace-section="\${area}"]\`);
          }
        }
        await wait(160);
      };

      // Always start on Home area regardless of persisted LuCI tab state from prior viewports
      await selectArea('home');

      // 1. Home Quick Scenarios + Pending Bar + Light & Dark Contrast
      const scenarioCards = Array.from(document.querySelectorAll('.fkp-next-scenarios .fkp-scenario-card'));
      if (scenarioCards.length !== 4) {
        issues.push(\`[home-scenarios] Expected 4 .fkp-scenario-card buttons, found \${scenarioCards.length}\`);
      } else {
        for (const c of scenarioCards) {
          const cr = c.getBoundingClientRect();
          if (cr.height < 64) {
            issues.push(\`[home-scenarios] Scenario card height=\${cr.height.toFixed(1)}px (<64px)\`);
          }
          if (cr.right > vpWidth + 1 || cr.left < -1) {
            issues.push(\`[home-scenarios] Scenario card overflows viewport (\${Math.round(cr.left)}..\${Math.round(cr.right)} vs 0..\${vpWidth})\`);
          }
        }
      }
      if (document.querySelector('.fkp-workspace-theme-toggle, [data-workspace-preferences], .fkp-workspace-theme')) {
        issues.push('[theme-contract] Manual theme controls must not exist; theme must come strictly from host LuCI');
      }
      checkAccessibilityAndContrast('light');
      document.documentElement.setAttribute('data-darkmode', 'true');
      await wait(220);
      if (document.querySelector('#cbi-forkop')?.dataset.theme !== 'dark') {
        issues.push('[theme-contract] Workspace did not inherit dark theme from host data-darkmode="true"');
      }
      checkAccessibilityAndContrast('dark');
      document.documentElement.setAttribute('data-darkmode', 'false');
      await wait(220);

      const pendingBar = document.querySelector('.fkp-workspace > .fkp-next-notice');
      if (pendingBar) {
        pendingBar.hidden = false;
        await wait(40);
        checkOverflowAndTargets('home-with-pending-bar');
        const pbStyle = getComputedStyle(pendingBar);
        if ((!isMobile && pbStyle.gridColumnStart !== '1') || (!isMobile && pbStyle.gridColumnEnd !== '-1')) {
          issues.push(\`[home-with-pending-bar] pendingBar gridColumn=\${pbStyle.gridColumn} does not span 1 / -1\`);
        }
        pendingBar.hidden = true;
      } else {
        checkOverflowAndTargets('home');
      }

      // 2. Dashboard & URLTest details modal + Monitoring sub-views
      const dashTabLink = document.querySelector('.cbi-tabmenu [data-tab="dashboard"] a');
      if (dashTabLink) {
        dashTabLink.click();
        await wait(220);
        checkOverflowAndTargets('dashboard');

        const detailsBtn = document.querySelector('.fkp_dashboard-page__outbound-grid__item__details-btn, .fkp_dashboard-page__outbound-grid__item--group');
        if (detailsBtn) {
          detailsBtn.click();
          await wait(120);
          const modal = document.querySelector('.modal');
          if (modal) {
            const mr = modal.getBoundingClientRect();
            if (mr.right > vpWidth + 1 || mr.left < -1) {
              issues.push(\`[urltest-modal] Modal overflows viewport (\${Math.round(mr.left)}..\${Math.round(mr.right)} vs 0..\${vpWidth})\`);
            }
            const table = modal.querySelector('.fkp_dashboard-page__urltest-details__table');
            if (table) {
              const tr = table.getBoundingClientRect();
              if (tr.right > mr.right + 1) {
                issues.push(\`[urltest-modal] URLTest details table overflows modal (\${Math.round(tr.right)} > \${Math.round(mr.right)})\`);
              }
            }
            window.ui?.hideModal?.();
            await wait(60);
          }
        }
      }

      const monTabLink = document.querySelector('.cbi-tabmenu [data-tab="monitoring"] a');
      if (monTabLink) {
        monTabLink.click();
        await wait(220);
        checkOverflowAndTargets('monitoring');
        for (const ctrl of document.querySelectorAll('.fkp_monitoring-page__device-filter, .fkp_monitoring-page__search')) {
          const cr = ctrl.getBoundingClientRect();
          if (cr.height > 60) {
            issues.push(\`[monitoring] Control \${ctrl.className} stretched vertically to height=\${cr.height.toFixed(1)}px (>60px)\`);
          }
        }
        for (const td of document.querySelectorAll('.fkp_monitoring-page__table tbody td')) {
          const r = td.getBoundingClientRect();
          if (r.width > 0 && r.right > vpWidth + 2) {
            issues.push(\`[monitoring] Table cell overflows viewport: right=\${Math.round(r.right)} > \${vpWidth}\`);
          }
        }
      }

      // 3. Servers area + Toast narrow-viewport check
      await selectArea('servers');
      checkOverflowAndTargets('servers');
      if (vpWidth <= 360) {
        const realContainer = document.querySelector('.toast-container') || (() => {
          const c = document.createElement('div');
          c.className = 'toast-container';
          document.body.append(c);
          return c;
        })();
        const t = document.createElement('div');
        t.className = 'toast toast-error visible';
        t.textContent = 'Проверка длинного уведомления на узком экране 320px без горизонтального переполнения';
        realContainer.append(t);
        await wait(30);
        const tr = t.getBoundingClientRect();
        if (tr.left < -1 || tr.right > vpWidth + 1) {
          issues.push(\`[toast] Toast overflows narrow viewport (\${Math.round(tr.left)}..\${Math.round(tr.right)} vs 0..\${vpWidth})\`);
        }
        t.remove();
      }

      // 4. Rules area + Console Mode badge + Rule Edit Modal (Subscription Preview Search + WG/AWG/WARP Subview)
      await selectArea('rules');
      checkOverflowAndTargets('rules');
      const rulesText = document.querySelector('#cbi-forkop-section')?.textContent || '';
      if (!rulesText.includes('Консольный режим (UDP напрямую)')) {
        issues.push('[rules] Missing Console Mode badge in #cbi-forkop-section route summary');
      }
      const editRuleBtn = document.querySelector('#cbi-forkop-section tr.cbi-section-table-row[data-sid="main"] .cbi-section-actions button.cbi-button-edit, #cbi-forkop-section tr.cbi-section-table-row .cbi-section-actions button.cbi-button-edit');
      if (editRuleBtn) {
        editRuleBtn.click();
        await wait(240);
        const modal = document.querySelector('#modal_overlay .modal');
        if (modal) {
          const mr = modal.getBoundingClientRect();
          if (mr.right > vpWidth + 1 || mr.left < -1) {
            issues.push(\`[rule-modal] Modal overflows viewport (\${Math.round(mr.left)}..\${Math.round(mr.right)} vs 0..\${vpWidth})\`);
          }
          const dynItem = modal.querySelector('.cbi-dynlist.fkp-connections-dynlist > .item');
          if (dynItem) {
            const padRight = parseFloat(getComputedStyle(dynItem).paddingRight || '0');
            if (padRight < 72) {
              issues.push(\`[rule-modal] DynamicList item paddingRight=\${padRight}px (<72px) allows action buttons to overlap input text\`);
            }
          }
          const dynAddBtn = modal.querySelector('.fkp-button-add-dynlist > .add-item > .cbi-button-add');
          if (dynAddBtn && isMobile) {
            const ar = dynAddBtn.getBoundingClientRect();
            if (ar.height > 0 && ar.height < 41.5) {
              issues.push(\`[rule-modal] Mobile DynamicList '+' button height=\${ar.height.toFixed(1)}px (<42px)\`);
            }
          }

          // Trigger Pre-save Subscription Preview inside modal
          const subPreviewBtn = modal.querySelector('.fkp-sub-preview-wrap button');
          if (subPreviewBtn) {
            subPreviewBtn.click();
            await wait(160);
            const searchInput = modal.querySelector('input[data-sub-preview-search]');
            if (!searchInput) {
              issues.push('[rule-modal] Expected live search input[data-sub-preview-search] for 8 previewed servers');
            } else {
              const sr = searchInput.getBoundingClientRect();
              if (sr.right > mr.right + 1) {
                issues.push('[rule-modal] Subscription preview search input overflows modal');
              }
            }
          }

          // Open WG / AmneziaWG / WARP Helper subview inside modal
          const wgHelperBtn = modal.querySelector('#cbi-forkop-main-_wg_warp_helper button');
          if (wgHelperBtn) {
            wgHelperBtn.click();
            await wait(120);
            const subview = modal.querySelector('.fkp-wg-warp-subview');
            if (!subview) {
              issues.push('[wg-warp-modal] Failed to open .fkp-wg-warp-subview');
            } else {
              const svr = subview.getBoundingClientRect();
              if (svr.right > mr.right + 2) {
                issues.push(\`[wg-warp-modal] WG/WARP subview overflows modal (\${Math.round(svr.right)} > \${Math.round(mr.right)})\`);
              }
              if (!subview.querySelector('input[type="file"][data-wg-conf-file]')) {
                issues.push('[wg-warp-modal] Missing .conf file upload input');
              }
              // Click Back button to restore rule modal
              modal.querySelector('.button-row > button')?.click();
              await wait(80);
            }
          }

          modal.querySelector('.button-row > button')?.click();
          await wait(80);
        }
      }

      // 5. Devices area
      await selectArea('devices');
      checkOverflowAndTargets('devices');

      // 6. Diagnostics + TSPU 4-Stage Pipeline + 1-Click Remediation + Updates Component Impact modal
      await selectArea('diagnostics');
      await wait(180);
      checkOverflowAndTargets('diagnostics');
      const ytPreset = document.querySelector('[data-tspu-preset="youtube.com"]');
      const tspuRunBtn = document.querySelector('[data-tspu-run]');
      if (!ytPreset || !tspuRunBtn) {
        issues.push('[diagnostics-tspu] Missing TSPU preset chip or run button');
      } else {
        ytPreset.click();
        tspuRunBtn.click();
        await wait(180);
        const stages = document.querySelectorAll('.fkp-tspu-stage');
        if (stages.length !== 4) {
          issues.push(\`[diagnostics-tspu] Expected 4 TSPU stages, found \${stages.length}\`);
        }
        const fixBtn = document.querySelector('[data-tspu-fix-route]');
        if (!fixBtn) {
          issues.push('[diagnostics-tspu] Missing 1-click [data-tspu-fix-route] remediation button');
        }
        checkOverflowAndTargets('diagnostics-tspu-result');
      }

      const updatesTabLink = document.querySelector('.cbi-tabmenu [data-tab="updates"] a');
      if (updatesTabLink) {
        updatesTabLink.click();
        await wait(200);
        checkOverflowAndTargets('updates');
        const installBtn = Array.from(document.querySelectorAll('.fkp_updates-page button'))
          .find((b) => !b.disabled && ((b.textContent || '').includes('Установить') || (b.textContent || '').includes('Обновить') || (b.textContent || '').includes('Install') || (b.textContent || '').includes('Update')));
        if (installBtn) {
          installBtn.click();
          await wait(180);
          const impactModal = document.querySelector('#modal_overlay .modal');
          if (impactModal) {
            if (!impactModal.classList.contains('fkp-workspace-modal')) {
              issues.push('[updates-impact-modal] showComponentImpact modal missing .fkp-workspace-modal theming class');
            }
            if (!impactModal.querySelector('.button-row')) {
              issues.push('[updates-impact-modal] showComponentImpact modal missing .button-row wrapper');
            }
            const imr = impactModal.getBoundingClientRect();
            if (imr.right > vpWidth + 1 || imr.left < -1) {
              issues.push(\`[updates-impact-modal] Modal overflows viewport (\${Math.round(imr.left)}..\${Math.round(imr.right)} vs 0..\${vpWidth})\`);
            }
            window.ui?.hideModal?.();
            await wait(60);
          }
        }
      }

      // 7. Settings area + Direct Torrent Bypass Group
      await selectArea('settings');
      await wait(180);
      checkOverflowAndTargets('settings');
      const directGroup = Array.from(document.querySelectorAll('#cbi-forkop-settings section.fkp-form-group'))
        .find((g) => (g.querySelector('h3')?.textContent || '').includes('Прямой трафик и торренты'));
      if (!directGroup) {
        issues.push('[settings] Missing open "Прямой трафик и торренты" group in #cbi-forkop-settings');
      }

      return issues;
    })()
  `);

  return issues;
}

async function main() {
  const serverPort = await getFreePort();
  const debugPort = await getFreePort();
  const server = await startLuciServer(serverPort);
  const chromium = await launchChromium(debugPort);
  const cdp = new CdpSession(chromium.pageWsUrl);

  let totalIssues = 0;
  try {
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    for (const vp of VIEWPORTS) {
      const issues = await auditViewport(
        cdp,
        `http://127.0.0.1:${serverPort}`,
        vp,
      );
      if (issues.length === 0) {
        console.log(`PASS ${vp.name} (${vp.width}x${vp.height})`);
      } else {
        console.log(
          `FAIL ${vp.name} (${vp.width}x${vp.height}) - ${issues.length} issue(s):`,
        );
        for (const issue of issues) {
          console.log(`  - ${issue}`);
        }
        totalIssues += issues.length;
      }
    }
  } finally {
    cdp.close();
    await chromium.cleanup();
    server.close();
  }

  if (totalIssues > 0) {
    console.error(`\nResponsive Chromium audit found ${totalIssues} issue(s).`);
    process.exit(1);
  }
  console.log('\nAll 9 viewports passed responsive Chromium LuCI audit!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
