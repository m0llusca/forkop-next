// @vitest-environment happy-dom
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { GlobalStyles } from '../../../styles';
import { copyToClipboard } from '../../../helpers/copyToClipboard';
import {
  getClashHttpUrl,
  getClashUIUrl,
  getClashWsUrl,
} from '../../../helpers/getClashApiUrl';
import { parseQueryString } from '../../../helpers/parseQueryString';
import { validateDNS } from '../../../validators/validateDns';
import { validatePath } from '../../../validators/validatePath';
import { validateShadowsocksUrl } from '../../../validators/validateShadowsocksUrl';
import { validateTrojanUrl } from '../../../validators/validateTrojanUrl';
import { validateVlessUrl } from '../../../validators/validateVlessUrl';
import { maskGlobalCheckText } from '../../tabs/diagnostic/helpers/maskDiagnostics';
import { showComponentImpact } from '../../tabs/updates/componentImpact';
import { renderRuleRoute } from '../rules';
import { mountForkopWorkspace } from '../render';

const repoRoot = path.resolve(process.cwd(), '..');
const luciForkopDir = path.join(
  repoRoot,
  'luci-app-forkop/htdocs/luci-static/resources/view/forkop',
);

afterEach(() => {
  document.body.replaceChildren();
  document.head
    .querySelectorAll('[data-audit-style]')
    .forEach((n) => n.remove());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('BUG-01 & SEC-03: server.js preserves server_password across shadowsocks/trojan/hysteria2 and masks secret inputs', () => {
  const serverJs = fs.readFileSync(
    path.join(luciForkopDir, 'server.js'),
    'utf8',
  );
  const passwordBlock =
    serverJs
      .split('option(form.Value, "server_password"')[1]
      ?.split('option(form.Value, "vmess_alter_id"')[0] || '';
  expect(passwordBlock).toContain('o.depends("protocol", "shadowsocks")');
  expect(passwordBlock).toContain('o.depends("protocol", "trojan")');
  expect(passwordBlock).toContain('o.depends("protocol", "hysteria2")');
  expect(passwordBlock).toContain('o.retain = true');
  expect(passwordBlock).toContain('o.password = true');

  const sectionJs = fs.readFileSync(
    path.join(luciForkopDir, 'section.js'),
    'utf8',
  );
  const mixedPwBlock =
    sectionJs.split('"mixed_proxy_password"')[1]?.slice(0, 400) || '';
  expect(mixedPwBlock).toContain('o.password = true');
});

it('BUG-06 & SEC-07: server.js does not overwrite intentional saved LAN public_host and avoids rawhtml on _protocol_display', () => {
  const serverJs = fs.readFileSync(
    path.join(luciForkopDir, 'server.js'),
    'utf8',
  );
  const applyHostBlock =
    serverJs.split('function applyDefaultPublicHost(')[1]?.slice(0, 450) || '';
  expect(applyHostBlock).not.toContain('currentHost === browserHost');

  const protoDisplayBlock =
    serverJs.split('"_protocol_display"')[1]?.slice(0, 260) || '';
  expect(protoDisplayBlock).not.toContain('rawhtml = true');
});

it('SEC-06: settings.js YACD link includes rel="noopener noreferrer" and getClashApiUrl brackets IPv6 literals', () => {
  const settingsJs = fs.readFileSync(
    path.join(luciForkopDir, 'settings.js'),
    'utf8',
  );
  const yacdBlock = settingsJs.split('"enable_yacd"')[1]?.slice(0, 400) || '';
  expect(yacdBlock).toContain('noopener noreferrer');

  vi.stubGlobal('location', {
    hostname: 'fd00::1',
    protocol: 'http:',
  });
  expect(getClashHttpUrl()).toBe('http://[fd00::1]:9090');
  expect(getClashWsUrl()).toBe('ws://[fd00::1]:9090');
  expect(getClashUIUrl()).toBe('http://[fd00::1]:9090/ui');
});

it('SEC-02: maskDiagnostics redacts multiline list outbound_jsons, option inbound_json, and domain_resolver_dns_server', () => {
  const raw = [
    "config section 'main'",
    "\tlist outbound_jsons '{",
    '  "type": "vless",',
    '  "uuid": "secret-outbound-uuid"',
    "}'",
    "\toption domain_resolver_dns_server 'https://dns.example/secret-token'",
    "config server 'srv'",
    "\toption inbound_json '{",
    '  "password": "secret-inbound-pw"',
    "}'",
  ].join('\n');
  const masked = maskGlobalCheckText(raw);
  expect(masked).not.toContain('secret-outbound-uuid');
  expect(masked).not.toContain('secret-inbound-pw');
  expect(masked).not.toContain('secret-token');
});

it('SEC-04 & Mobile P0-3: copyToClipboard removes stale globalFallback on subsequent copy success and mounts inside workspace surface', async () => {
  const workspace = document.createElement('div');
  workspace.className = 'fkp-workspace';
  const main = document.createElement('div');
  main.className = 'fkp-workspace-main';
  const header = document.createElement('div');
  header.className = 'fkp_dashboard-page__outbound-grid__item__header';
  const btn = document.createElement('button');
  header.append(btn);
  main.append(header);
  workspace.append(main);
  document.body.append(workspace);
  btn.focus();

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: () => false,
  });

  expect(await copyToClipboard('vless://secret-share-link')).toBe(false);
  const fallback = document.querySelector('.fkp-copy-feedback')!;
  expect(fallback).not.toBeNull();
  expect(fallback.parentElement).not.toBe(header);

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async () => undefined },
  });
  expect(await copyToClipboard('safe-text')).toBe(true);
  expect(document.querySelector('.fkp-copy-feedback')).toBeNull();
});

it('SEC-05 & BUG-07 & BUG-08: validators block path traversal, accept URL-safe unpadded ss:// with #tag:colon and plain vless://, and reject invalid DNS paths', () => {
  expect(validatePath('/etc/forkop/../../etc/shadow').valid).toBe(false);
  expect(validatePath('/etc/forkop//config.json').valid).toBe(false);
  expect(validatePath('/etc/sing-box/config.json').valid).toBe(true);

  expect(() =>
    parseQueryString('sni=example.com&bad=%E0%A4%A&extra=a=b=c'),
  ).not.toThrow();
  expect(parseQueryString('sni=example.com&extra=a%3Db=1').extra).toBe('a=b=1');

  // URL-safe unpadded base64 ("2022-blake3-aes-128-gcm:secret-pass_word" -> MjAyMi1ibGFrZTMtYWVzLTEyOC1nY206c2VjcmV0LXBhc3Nfd29yZA)
  expect(
    validateShadowsocksUrl(
      'ss://MjAyMi1ibGFrZTMtYWVzLTEyOC1nY206c2VjcmV0LXBhc3Nfd29yZA@edge.example.com:8388#DE:1',
    ).valid,
  ).toBe(true);
  expect(
    validateShadowsocksUrl('ss://not-base64-no-colon@1.2.3.4:443').valid,
  ).toBe(false);

  expect(
    validateVlessUrl(
      'vless://11111111-1111-1111-1111-111111111111@edge.example.com:443#PlainNode',
    ).valid,
  ).toBe(true);

  expect(
    validateTrojanUrl(
      'trojan://p%40ssword@edge.example.com:443/?sni=edge.example.com#Node',
    ).valid,
  ).toBe(true);

  expect(validateDNS('8.8.8.8/foo bar').valid).toBe(false);
  expect(validateDNS('8.8.8.8').valid).toBe(true);
});

it('BUG-03: renderRuleRoute counts child subscription_url, section_interface, urltest, and priority_group sources', () => {
  const node = renderRuleRoute({
    action: 'connection',
    subscription_urls_count: 2,
    interfaces_count: 1,
    urltest_count: 1,
    priority_group_count: 1,
  } as unknown as Parameters<typeof renderRuleRoute>[0]);
  expect(node.textContent).not.toContain('Источники не заданы');
  expect(node.textContent).toContain('Подписки: 2');
  expect(node.textContent).toContain('Интерфейсы: 1');
  expect(node.textContent).toContain('URLTest: 1');
  expect(node.textContent).toContain('Приоритет: 1');
});

it('Mobile P0-1 & P0-2: pendingBar spans full grid width without collapsing main column, and showComponentImpact marks modal for theming/wrapping', () => {
  const style = document.createElement('style');
  style.dataset.auditStyle = '';
  style.textContent = GlobalStyles;
  document.head.append(style);

  const root = document.createElement('div');
  root.id = 'cbi-forkop';
  root.className = 'cbi-map';
  root.innerHTML =
    '<ul class="cbi-tabmenu"><li class="cbi-tab" data-tab="next"><a href="#">Next</a></li></ul><div class="cbi-map-tabbed"><section class="cbi-section" data-tab="next" data-tab-active="true"></section></div>';
  document.body.append(root);
  mountForkopWorkspace(root);

  const pendingBar = document.createElement('div');
  pendingBar.className = 'fkp-next-notice';
  pendingBar.textContent = 'Есть несохранённые изменения';
  root.prepend(pendingBar);

  expect(getComputedStyle(pendingBar).gridColumn).toBe('1 / -1');

  let modalNode: HTMLElement | null = null;
  vi.stubGlobal('ui', {
    showModal: (_title: string, content: HTMLElement) => {
      const overlay = document.createElement('div');
      overlay.id = 'modal_overlay';
      modalNode = document.createElement('div');
      modalNode.className = 'modal';
      modalNode.append(content);
      overlay.append(modalNode);
      document.body.append(overlay);
    },
    hideModal: () => undefined,
  });
  vi.stubGlobal('L', {
    resolveDefault: (p: Promise<unknown>) => p,
  });
  vi.stubGlobal('fs', {
    exec_direct: () => new Promise(() => undefined),
    exec: () => new Promise(() => undefined),
  });

  const impactContent = showComponentImpact({
    component: 'sing-box',
    action: 'install',
    currentVersion: '1.14.3',
    proceed: () => undefined,
    available: () => true,
  });
  expect(impactContent.className).toContain('fkp-');
  expect(impactContent.querySelector('.button-row')).not.toBeNull();
});

it('SEC-01: updates initController validates release_url protocol as https:', () => {
  const updatesCtrl = fs.readFileSync(
    path.join(process.cwd(), 'src/forkop/tabs/updates/initController.ts'),
    'utf8',
  );
  expect(updatesCtrl).toContain("protocol === 'https:'");
});

it('BUG-02: shell waitComponentActionJob does not loop infinitely on failed forkop self-update and uses _() for installation message', () => {
  const shellTs = fs.readFileSync(
    path.join(process.cwd(), 'src/forkop/methods/shell/index.ts'),
    'utf8',
  );
  expect(shellTs).not.toContain("translate('Forkop has been installed')");
  expect(shellTs).toContain("_('Forkop has been installed')");
  const selfUpdateBlock =
    shellTs
      .split("if (component === 'forkop' && action === 'install')")[1]
      ?.split('return failure;')[0] || '';
  expect(selfUpdateBlock).not.toMatch(/\n\s*continue;\s*$/);
});

it('BUG-04: forkop.js localChanges tracks "removes" and refreshes pendingBar on renderContents', () => {
  const forkopJs = fs.readFileSync(
    path.join(luciForkopDir, 'forkop.js'),
    'utf8',
  );
  const localChangesBlock =
    forkopJs.split('const localChanges = function')[1]?.slice(0, 260) || '';
  expect(localChangesBlock).toContain('"removes"');

  const renderContentsBlock =
    forkopJs
      .split('forkopMap.renderContents = function')[1]
      ?.split('const forkopView = this;')[0] || '';
  expect(renderContentsBlock).toContain('nativeDirty = localChanges()');
});

it('BUG-05: section.js snapshots child UCI sections on rule modal open and restores them on parent modal Cancel', () => {
  const sectionJs = fs.readFileSync(
    path.join(luciForkopDir, 'section.js'),
    'utf8',
  );
  const configSectionBlock =
    sectionJs.split('function configureSectionSection(')[1] || '';
  expect(configSectionBlock).toContain('handleModalCancel');
  expect(configSectionBlock).toContain('addModalOptions');
});
