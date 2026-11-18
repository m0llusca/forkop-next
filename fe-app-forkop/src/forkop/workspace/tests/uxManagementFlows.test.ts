// @vitest-environment happy-dom
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderNextPanel } from '../../next/render';
import {
  configureRuleWorkflow,
  renderQuickSite,
  type RuleDestination,
} from '../../next/workflows';
import { nextStyles } from '../../next/styles';
import { renderSymptomGuide } from '../../tabs/diagnostic/symptomGuide';
import { enhanceForkopForms } from '../formGuide';
import { renderRuleRoute } from '../rules';
import { workspaceStyles } from '../styles';
import { validateProxyUrl } from '../../../validators/validateProxyUrl';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../../..');
const luciForkopDir = path.join(
  repoRoot,
  'luci-app-forkop/htdocs/luci-static/resources/view/forkop',
);

const WG_PRIV = 'YAnz5TF+lXXJte14tji3zlMNq+hd2rYUIgJBgB3fBmk=';
const WG_PUB = 'bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=';

afterEach(() => {
  document.body.replaceChildren();
  document.head
    .querySelectorAll('[data-ux-flow-style]')
    .forEach((node) => node.remove());
});

function buildLuciMapShell() {
  const map = document.createElement('div');
  map.id = 'cbi-forkop';
  map.className = 'cbi-map fkp-workspace';
  map.innerHTML = `
    <ul class="cbi-tabmenu">
      <li data-tab="next" class="cbi-tab"><a href="#">Главная</a></li>
      <li data-tab="dashboard" class="cbi-tab-disabled"><a href="#">Серверы</a></li>
      <li data-tab="section" class="cbi-tab-disabled"><a href="#">Правила</a></li>
      <li data-tab="devices" class="cbi-tab-disabled"><a href="#">Устройства</a></li>
      <li data-tab="diagnostic" class="cbi-tab-disabled"><a href="#">Диагностика</a></li>
      <li data-tab="settings" class="cbi-tab-disabled"><a href="#">Настройки</a></li>
    </ul>
    <div class="cbi-map-tabbed">
      <div class="cbi-section" data-tab="next" data-tab-active="true"></div>
      <div class="cbi-section" data-tab="dashboard" data-tab-active="false"></div>
      <div class="cbi-section" data-tab="section" data-tab-active="false"></div>
      <div class="cbi-section" data-tab="devices" data-tab-active="false"></div>
      <div class="cbi-section" data-tab="diagnostic" data-tab-active="false">
        <input name="tspu_domain" placeholder="youtube.com" />
      </div>
      <div class="cbi-section" data-tab="settings" data-tab-active="false">
        <div id="cbi-forkop-settings">
          <div class="cbi-value" id="cbi-forkop-settings-dns_type">
            <div class="cbi-value-field"><select id="widget.cbid.forkop.settings.dns_type"><option value="doh">DoH</option></select></div>
          </div>
          <div class="cbi-value" id="cbi-forkop-settings-bittorrent_direct">
            <div class="cbi-value-field"><input type="checkbox" id="cbid.forkop.settings.bittorrent_direct" /></div>
          </div>
        </div>
      </div>
    </div>
  `;
  for (const li of map.querySelectorAll<HTMLElement>('.cbi-tabmenu > li')) {
    const tabId = li.dataset.tab!;
    li.querySelector('a')!.addEventListener('click', (e) => {
      e.preventDefault();
      for (const item of map.querySelectorAll<HTMLElement>(
        '.cbi-tabmenu > li',
      )) {
        item.className =
          item.dataset.tab === tabId ? 'cbi-tab' : 'cbi-tab-disabled';
      }
      for (const pane of map.querySelectorAll<HTMLElement>(
        '.cbi-map-tabbed > [data-tab]',
      )) {
        pane.dataset.tabActive = String(pane.dataset.tab === tabId);
      }
    });
  }
  document.body.append(map);
  return map;
}

describe('Multi-Persona Management UX Flows', () => {
  it('Persona 1 (Everyday Home): surfaces 4 task-oriented quick scenarios without breaking mount/selector invariants', async () => {
    const map = buildLuciMapShell();
    const request = vi.fn();
    const navigated: RuleDestination[] = [];
    const sectionPane = map.querySelector<HTMLElement>(
      '.cbi-map-tabbed > [data-tab="section"]',
    )!;
    sectionPane.addEventListener('forkop:navigate-rule', (event) => {
      event.preventDefault();
      navigated.push((event as CustomEvent<RuleDestination>).detail);
    });

    const panel = renderNextPanel(
      request,
      async () => ({
        success: true,
        data: [
          {
            code: 'main',
            sectionName: 'main',
            displayName: 'Основное подключение',
            type: 'selector',
            outbounds: [
              {
                code: 'warp-1',
                displayName: 'Cloudflare WARP',
                latency: 28,
                selected: true,
              },
            ],
          },
        ],
      }),
      { workspace: true },
    );
    map.querySelector('.cbi-map-tabbed > [data-tab="next"]')!.append(panel);
    await new Promise((r) => setTimeout(r, 0));

    // Critical invariants preserved:
    expect(request).not.toHaveBeenCalled();
    expect(panel.querySelector('select')).toBeNull();
    expect(panel.querySelector('header')).toBeNull();
    expect(panel.querySelector<HTMLInputElement>('input')!.name).toBe(
      'connection_domain',
    );
    const probe = panel.querySelector('.fkp-next-probe')!;
    const scenarios = panel.querySelector('.fkp-next-scenarios')!;
    expect(scenarios).not.toBeNull();
    expect(
      Boolean(
        probe.compareDocumentPosition(scenarios) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);

    const cards = [
      ...scenarios.querySelectorAll<HTMLButtonElement>(
        'button.fkp-scenario-card[data-scenario]',
      ),
    ];
    expect(cards.map((c) => c.dataset.scenario)).toEqual([
      'vpn-warp',
      'gaming-nat',
      'tspu-check',
      'torrents-direct',
    ]);

    // 1. VPN / WARP scenario opens main rule sources targeting _wg_warp_helper
    cards[0].click();
    expect(navigated[navigated.length - 1]).toEqual({
      kind: 'edit',
      section: 'main',
      option: '_wg_warp_helper',
    });

    // 2. Gaming Open NAT scenario navigates to devices tab
    cards[1].click();
    expect(
      map.querySelector<HTMLElement>('.cbi-map-tabbed > [data-tab="devices"]')!
        .dataset.tabActive,
    ).toBe('true');

    // 3. TSPU 16-20 KB scenario navigates to diagnostic tab and focuses tspu_domain
    cards[2].click();
    expect(
      map.querySelector<HTMLElement>(
        '.cbi-map-tabbed > [data-tab="diagnostic"]',
      )!.dataset.tabActive,
    ).toBe('true');
    expect(document.activeElement).toBe(
      map.querySelector('input[name="tspu_domain"]'),
    );

    // 4. Torrents direct scenario navigates to settings tab and focuses bittorrent_direct
    cards[3].click();
    expect(
      map.querySelector<HTMLElement>('.cbi-map-tabbed > [data-tab="settings"]')!
        .dataset.tabActive,
    ).toBe('true');
    expect(document.activeElement).toBe(
      map.querySelector('#cbid\\.forkop\\.settings\\.bittorrent_direct'),
    );
  });

  it('Persona 2 (Video Stalling Diagnosis -> 1-Click Fix): presets domain, numbers 4 TSPU stages, and pre-fills rule modal via configureRuleWorkflow', async () => {
    const map = buildLuciMapShell();

    // Mount native rule workflow on [data-tab="section"]
    const modalRoot = document.createElement('div');
    modalRoot.className = 'modal cbi-modal fkp-workspace-modal';
    modalRoot.innerHTML = `
      <ul class="cbi-tabmenu">
        <li data-tab="settings"><a href="#">Настройки</a></li>
        <li data-tab="conditions"><a href="#">Условия</a></li>
      </ul>
      <div class="cbi-section-node-tabbed">
        <div data-tab="settings" data-tab-active="true">
          <div class="cbi-value" id="cbi-forkop-main-_wg_warp_helper">
            <button type="button" id="btn-wg-helper">Import WireGuard</button>
          </div>
        </div>
        <div data-tab="conditions" data-tab-active="false">
          <div class="cbi-value" id="cbi-forkop-main-domain"></div>
        </div>
      </div>
    `;
    for (const li of modalRoot.querySelectorAll<HTMLElement>(
      '.cbi-tabmenu > li',
    )) {
      const tabId = li.dataset.tab!;
      li.querySelector('a')!.addEventListener('click', (e) => {
        e.preventDefault();
        for (const p of modalRoot.querySelectorAll<HTMLElement>(
          '.cbi-section-node-tabbed > [data-tab]',
        )) {
          p.dataset.tabActive = String(p.dataset.tab === tabId);
        }
      });
    }
    const domainTextarea = document.createElement('textarea');
    domainTextarea.id = 'cbid.forkop.main.domain';
    const quickSite = renderQuickSite(
      domainTextarea,
      'Основное подключение',
      1,
    );
    modalRoot
      .querySelector('#cbi-forkop-main-domain')!
      .append(quickSite, domainTextarea);
    document.body.append(modalRoot);

    const fakeSection = {
      map: {
        config: 'forkop',
        data: {
          get: (_cfg: string, sid: string) =>
            sid === 'main' ? { '.name': 'main', action: 'connection' } : null,
        },
      },
      renderContents() {
        const host = document.createElement('div');
        host.innerHTML = `<div class="cbi-section-create"><button type="button">Add</button></div><table><tbody><tr data-sid="main"><td class="cbi-section-actions"></td></tr></tbody></table>`;
        return host;
      },
      renderMoreOptionsModal() {
        return Promise.resolve();
      },
      getActiveModalMap() {
        return modalRoot;
      },
    };
    configureRuleWorkflow(fakeSection);
    const renderedTable = fakeSection.renderContents();
    // Forward section pane events to table just like LuCI section wrapper
    const sectionPane = map.querySelector<HTMLElement>(
      '.cbi-map-tabbed > [data-tab="section"]',
    )!;
    sectionPane.append(renderedTable);
    sectionPane.addEventListener('forkop:navigate-rule', (e) => {
      if (e.target === sectionPane) {
        const forwarded = new CustomEvent('forkop:navigate-rule', {
          cancelable: true,
          detail: (e as CustomEvent).detail,
        });
        if (!renderedTable.dispatchEvent(forwarded)) e.preventDefault();
      }
    });

    const readCalls: Array<[string, Record<string, unknown> | undefined]> = [];
    const guide = renderSymptomGuide(async (action, payload) => {
      readCalls.push([action, payload]);
      if (action === 'status') {
        return {
          success: true,
          data: {
            sections: [
              {
                name: 'main',
                label: 'Основное подключение',
                action: 'connection',
              },
            ],
          },
        };
      }
      if (action === 'tspu_classify') {
        return {
          success: true,
          data: {
            verdict: 'tspu_byte_cap_16kb',
            stages: [
              { stage: 'dns', status: 'ok', remote_ip: '142.250.74.110' },
              { stage: 'tcp', status: 'ok', duration_ms: 19 },
              { stage: 'tls', status: 'ok', duration_ms: 34 },
              { stage: 'byte_cap', status: 'failed', bytes_read: 16384 },
            ],
          },
        };
      }
      return { success: true, data: {} };
    });
    map
      .querySelector('.cbi-map-tabbed > [data-tab="diagnostic"]')!
      .replaceChildren(guide);
    await new Promise((r) => setTimeout(r, 0));

    // Invariant: first button in SymptomGuide remains 'Проверить выбранный сценарий' and only status was read
    expect(guide.querySelector('button')!.textContent).toBe(
      'Проверить выбранный сценарий',
    );
    expect(readCalls.map(([a]) => a)).toEqual(['status']);

    // Clicking quick domain chip populates tspu_domain without firing tspu_classify
    const ytChip = guide.querySelector<HTMLButtonElement>(
      '[data-tspu-preset="youtube.com"]',
    )!;
    expect(ytChip).not.toBeNull();
    ytChip.click();
    expect(
      guide.querySelector<HTMLInputElement>('input[name="tspu_domain"]')!.value,
    ).toBe('youtube.com');
    expect(readCalls.map(([a]) => a)).toEqual(['status']);

    // Run TSPU classification
    guide.querySelector<HTMLButtonElement>('[data-tspu-run]')!.click();
    await new Promise((r) => setTimeout(r, 0));

    const stageTitles = [
      ...guide.querySelectorAll('.fkp-tspu-stage > strong'),
    ].map((n) => n.textContent);
    expect(stageTitles).toEqual([
      '1. DNS',
      '2. TCP',
      '3. TLS ClientHello',
      '4. Передача 64 КБ / лимит 16–20 КБ',
    ]);

    // 1-click fix button appears and routes youtube.com into QuickSite of 'main'
    const fixBtn = guide.querySelector<HTMLButtonElement>(
      '[data-tspu-fix-route]',
    )!;
    expect(fixBtn).not.toBeNull();
    expect(fixBtn.textContent).toContain('youtube.com');
    fixBtn.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(
      modalRoot.querySelector<HTMLElement>(
        '.cbi-section-node-tabbed > [data-tab="conditions"]',
      )!.dataset.tabActive,
    ).toBe('true');
    const quickSiteInput = modalRoot.querySelector<HTMLInputElement>(
      '[aria-label="Сайт или адрес страницы"]',
    )!;
    expect(quickSiteInput.value).toBe('youtube.com');
    expect(modalRoot.querySelector('output')!.textContent).toContain(
      'youtube.com и все его поддомены',
    );
  });

  it('Persona 3 (Power User): supports .conf file upload + format detection and live search on large subscription previews', async () => {
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

    const serverNames = [
      'DE Frankfurt 01',
      'DE Berlin 02',
      'NL Amsterdam 01',
      'NL Rotterdam 02',
      'FI Helsinki 01',
      'US New York 01',
      'SG Singapore 01',
      'JP Tokyo 01',
    ];
    const countries: Record<string, string> = {
      'DE Frankfurt 01': 'de',
      'DE Berlin 02': 'de',
      'NL Amsterdam 01': 'nl',
      'NL Rotterdam 02': 'nl',
      'FI Helsinki 01': 'fi',
      'US New York 01': 'us',
      'SG Singapore 01': 'sg',
      'JP Tokyo 01': 'jp',
    };

    const previewCache = new Map();
    const choicesCache = new Map();
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
      `${block![0]}\nreturn { renderSubscriptionPreviewToolbar, openWgWarpHelperModal };`,
    );

    const api = buildApi(
      makeE,
      (s: string) => s,
      {
        write: async () => {},
        exec: async () => ({
          code: 0,
          stdout: JSON.stringify({
            success: true,
            names: serverNames,
            countries,
            count: serverNames.length,
          }),
          stderr: '',
        }),
      },
      {
        get: () => 'country_is',
        set: () => {},
        sections: () => [],
      },
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
      () => ['https://sub.example.com/api/v1'],
      (v: unknown) => (Array.isArray(v) ? v : v ? [String(v)] : []),
      () => [],
      () => false,
      (_sid: string, item: string) => item,
      () => ({}),
      () => [],
      () => ({}),
      () => [],
      (o: unknown) => (o && typeof o === 'object' ? o : {}),
      () => {},
      () => [],
    );

    // 1. Subscription preview search with 8 servers
    const previewNode = api.renderSubscriptionPreviewToolbar(
      'main',
    ) as HTMLElement;
    document.body.append(previewNode);
    previewNode.querySelector('button')!.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(previewNode.textContent).toContain('[DE] DE Frankfurt 01');
    const searchInput = previewNode.querySelector<HTMLInputElement>(
      'input[data-sub-preview-search]',
    )!;
    expect(searchInput).not.toBeNull();
    searchInput.value = 'nl';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    const visibleChips = [
      ...previewNode.querySelectorAll<HTMLElement>('.fkp-sub-preview-chip'),
    ].filter((chip) => !chip.hidden);
    expect(visibleChips.length).toBe(2);
    expect(visibleChips[0].textContent).toContain('[NL] NL Amsterdam 01');

    // 2. WG / AWG modal file upload & live format detection
    api.openWgWarpHelperModal('main');
    const modal = document.querySelector('[data-modal-host]')!;
    const fileInput = modal.querySelector<HTMLInputElement>(
      'input[type="file"][data-wg-conf-file]',
    )!;
    const detected = modal.querySelector<HTMLElement>(
      '[data-wg-conf-detected]',
    )!;
    expect(fileInput).not.toBeNull();
    expect(detected).not.toBeNull();

    const textarea = modal.querySelector('textarea')!;
    textarea.value = `[Interface]\nPrivateKey = ${WG_PRIV}\nAddress = 10.8.0.2/32\nJc = 4\nJmin = 40\nJmax = 70\n[Peer]\nPublicKey = ${WG_PUB}\nEndpoint = 198.51.100.10:51820`;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    expect(detected.textContent).toContain('AmneziaWG');
  });

  it('Persona 4 (Gamer & Media User): surfaces P2P direct group, Console Mode route badge, and theme-clean tokens', () => {
    // 1. P2P settings get their own open section in settings
    const root = document.createElement('div');
    root.className = 'fkp-workspace';
    const settingsParent = document.createElement('div');
    settingsParent.id = 'cbi-forkop-settings';
    for (const id of [
      'dns_type',
      'source_network_interfaces',
      'bittorrent_direct',
      'torrserver_direct',
      'enable_yacd',
      'update_interval',
      'config_path',
    ]) {
      const f = document.createElement('div');
      f.className = 'cbi-value';
      f.id = `cbi-forkop-settings-${id}`;
      settingsParent.append(f);
    }
    root.append(settingsParent);
    enhanceForkopForms(root);

    const directGroup = [
      ...settingsParent.querySelectorAll<HTMLElement>('section.fkp-form-group'),
    ].find(
      (g) => g.querySelector('h3')?.textContent === 'Прямой трафик и торренты',
    )!;
    expect(directGroup).toBeDefined();
    expect(
      directGroup.querySelector('#cbi-forkop-settings-bittorrent_direct'),
    ).not.toBeNull();
    expect(
      directGroup.querySelector('#cbi-forkop-settings-torrserver_direct'),
    ).not.toBeNull();

    // 2. Console mode badge in rule route summary
    const withConsole = renderRuleRoute({
      action: 'connection',
      selector_proxy_links: ['warp://profile'],
      console_mode: '1',
    });
    expect(withConsole.querySelector('.fkp-rule-route')?.textContent).toBe(
      'Ссылки: 1 · Консольный режим (UDP напрямую)',
    );

    const withoutConsole = renderRuleRoute({
      action: 'connection',
      selector_proxy_links: ['warp://profile'],
      console_mode: '0',
    });
    expect(withoutConsole.querySelector('.fkp-rule-route')?.textContent).toBe(
      'Ссылки: 1',
    );

    // 3. No hardcoded red hex on failed TSPU stage; inherits dark workspace tokens
    expect(nextStyles).not.toContain('#c93b3b');
    const style = document.createElement('style');
    style.dataset.uxFlowStyle = '';
    style.textContent = nextStyles + workspaceStyles;
    document.head.append(style);
    expect(nextStyles).toContain('.fkp-scenario-card');

    const darkWs = document.createElement('div');
    darkWs.id = 'cbi-forkop';
    darkWs.className = 'cbi-map fkp-workspace';
    darkWs.dataset.theme = 'dark';
    darkWs.innerHTML = `
      <section class="fkp-next fkp-next-overview">
        <button type="button" class="fkp-scenario-card">
          <strong class="fkp-scenario-title">Подключить VPN</strong>
          <span class="fkp-scenario-desc">Описание сценария</span>
        </button>
        <div class="fkp-tspu-stage" data-tspu-status="failed">
          <strong>4. Передача 64 КБ / лимит 16–20 КБ</strong>
        </div>
      </section>
    `;
    document.body.append(darkWs);
    const failedStage = darkWs.querySelector<HTMLElement>(
      '.fkp-tspu-stage[data-tspu-status="failed"]',
    )!;
    const scenarioCard =
      darkWs.querySelector<HTMLElement>('.fkp-scenario-card')!;
    expect(getComputedStyle(failedStage).borderColor).toBe('#ffb4b8');
    expect(getComputedStyle(scenarioCard).backgroundColor).toBe('#21333e');
    expect(
      getComputedStyle(darkWs.querySelector('.fkp-next')!).getPropertyValue(
        '--fkp-hover',
      ),
    ).toBe('#29423f');
  });

  it('Cycle 7 (IA & Logical Placement): contextualizes LuCI footer, groups QUIC/NTP/latency/YACD/_extended_preview logically, orders Diagnostics & Servers by task priority, and streamlines Devices/Gaming flows', async () => {
    vi.stubGlobal('_', (s: string) => s);
    vi.stubGlobal(
      'E',
      (
        tag: string,
        attrs: Record<string, unknown> = {},
        children: unknown = [],
      ) => {
        const node = document.createElement(tag);
        for (const [key, value] of Object.entries(attrs || {})) {
          if (typeof value === 'function') {
            node.addEventListener(key, value as EventListener);
          } else if (value !== undefined && value !== null && value !== false) {
            node.setAttribute(key, String(value));
          }
        }
        const add = (v: unknown) => {
          if (Array.isArray(v)) v.forEach(add);
          else if (v instanceof Node) node.append(v);
          else if (typeof v === 'string')
            node.append(document.createTextNode(v));
        };
        add(children);
        return node;
      },
    );

    const style = document.createElement('style');
    style.dataset.uxFlowStyle = '';
    style.textContent = nextStyles + workspaceStyles;
    document.head.append(style);

    // 1. Contextual .cbi-page-actions footer + bottom preferences placement
    const { mountForkopWorkspace } = await import('../render');
    const map = buildLuciMapShell();
    const footer = document.createElement('div');
    footer.className = 'cbi-page-actions';
    footer.innerHTML =
      '<button class="cbi-button cbi-button-apply">Save & Apply</button>';
    map.after(footer);
    mountForkopWorkspace(map);

    // On 'next' (read-only / instant RPC), footer is hidden when no pending UCI draft exists
    expect(footer.hidden).toBe(true);
    expect(getComputedStyle(footer).display).toBe('none');

    // Switching to UCI-backed 'settings' reveals footer
    map
      .querySelector<HTMLButtonElement>('[data-workspace-section="settings"]')!
      .click();
    expect(footer.hidden).toBe(false);
    expect(getComputedStyle(footer).display).toBe('flex');

    // Switching to instant-RPC 'devices' hides footer when clean, but shows it if pendingBar is active
    map
      .querySelector<HTMLButtonElement>('[data-workspace-section="devices"]')!
      .click();
    expect(footer.hidden).toBe(true);
    const pendingNotice = document.createElement('div');
    pendingNotice.className = 'fkp-next-notice';
    pendingNotice.setAttribute('role', 'status');
    pendingNotice.textContent = 'Есть несохранённые изменения';
    map.prepend(pendingNotice);
    await new Promise((r) => setTimeout(r, 0));
    expect(footer.hidden).toBe(false);
    pendingNotice.hidden = true;
    pendingNotice.setAttribute('hidden', '');
    await new Promise((r) => setTimeout(r, 0));
    expect(footer.hidden).toBe(true);

    // 2. Logical Settings grouping (QUIC/NTP -> direct, latency_test_url -> network, YACD collapsed by default) + _extended_preview in sources
    const settingsScope = document.createElement('div');
    settingsScope.className = 'fkp-workspace';
    const settingsParent = document.createElement('div');
    settingsParent.id = 'cbi-forkop-settings';
    for (const key of [
      'dns_type',
      'source_network_interfaces',
      'latency_test_url',
      'bittorrent_direct',
      'torrserver_direct',
      'disable_quic',
      'exclude_ntp',
      'enable_yacd',
      'update_interval',
      'config_path',
    ]) {
      const row = document.createElement('div');
      row.className = 'cbi-value';
      row.id = `cbi-forkop-settings-${key}`;
      const input = document.createElement('input');
      if (key === 'enable_yacd') input.type = 'checkbox';
      row.append(input);
      settingsParent.append(row);
    }
    settingsScope.append(settingsParent);
    enhanceForkopForms(settingsScope);

    const directSection = [
      ...settingsParent.querySelectorAll('section.fkp-form-group'),
    ].find(
      (g) => g.querySelector('h3')?.textContent === 'Прямой трафик и торренты',
    )!;
    expect(
      directSection.querySelector('#cbi-forkop-settings-disable_quic'),
    ).not.toBeNull();
    expect(
      directSection.querySelector('#cbi-forkop-settings-exclude_ntp'),
    ).not.toBeNull();

    const networkSection = [
      ...settingsParent.querySelectorAll('section.fkp-form-group'),
    ].find((g) => g.querySelector('h3')?.textContent === 'Сетевые интерфейсы')!;
    expect(
      networkSection.querySelector('#cbi-forkop-settings-latency_test_url'),
    ).not.toBeNull();

    const yacdDetails = [
      ...settingsParent.querySelectorAll<HTMLDetailsElement>(
        'details.fkp-form-group',
      ),
    ].find(
      (g) => g.querySelector('summary')?.textContent === 'Доступ к контроллеру',
    );
    expect(yacdDetails).toBeDefined();
    expect(yacdDetails!.open).toBe(false);

    const ruleModalScope = document.createElement('div');
    ruleModalScope.className = 'fkp-workspace-modal';
    const ruleTab = document.createElement('div');
    ruleTab.dataset.tab = 'settings';
    for (const key of [
      'enabled',
      'action',
      'urltest',
      'priority_group',
      '_extended_preview',
    ]) {
      const row = document.createElement('div');
      row.className = 'cbi-value';
      row.id = `cbi-forkop-main-${key}`;
      ruleTab.append(row);
    }
    ruleModalScope.append(ruleTab);
    enhanceForkopForms(ruleModalScope);
    const sourcesSection = [
      ...ruleTab.querySelectorAll('.fkp-form-group'),
    ].find((g) => g.textContent?.includes('Источники подключения'))!;
    expect(
      sourcesSection.querySelector('#cbi-forkop-main-_extended_preview'),
    ).not.toBeNull();

    // 3. Diagnostics safe-first sidebar grouping (Logs/Config/GlobalCheck before Restart/Stop)
    const { renderAvailableActions } = await import(
      '../../tabs/diagnostic/partials/renderAvailableActions'
    );
    const noopAction = {
      loading: false,
      visible: true,
      disabled: false,
      onClick: () => {},
    };
    const hiddenAction = { ...noopAction, visible: false };
    const actionsNode = renderAvailableActions({
      restart: noopAction,
      start: hiddenAction,
      stop: noopAction,
      enable: hiddenAction,
      disable: noopAction,
      globalCheck: noopAction,
      viewLogs: noopAction,
      showSingBoxConfig: noopAction,
    }) as HTMLElement;
    const actionLabels = [...actionsNode.querySelectorAll('button')].map((b) =>
      b.textContent?.trim(),
    );
    expect(actionLabels.indexOf('View logs')).toBeGreaterThanOrEqual(0);
    expect(actionLabels.indexOf('View logs')).toBeLessThan(
      actionLabels.indexOf('Restart Forkop'),
    );
    expect(actionLabels.indexOf('Show sing-box config')).toBeLessThan(
      actionLabels.indexOf('Stop Forkop'),
    );
    expect(actionLabels[actionLabels.length - 1]).toBe('Stop Forkop');

    const initControllerSrc = fs.readFileSync(
      path.resolve(__dirname, '../../tabs/diagnostic/initController.ts'),
      'utf8',
    );
    expect(initControllerSrc).not.toMatch(/\.prepend\(\s*guide/);
    expect(initControllerSrc).toMatch(/\.append\(\s*guide/);

    // 4. Servers Outbound Group header: Test latency & subscription update BEFORE rule shortcuts
    const { renderSections } = await import(
      '../../tabs/dashboard/partials/renderSections'
    );
    const serverCard = renderSections({
      loading: false,
      failed: false,
      section: {
        code: 'main-out',
        sectionName: 'main',
        displayName: 'Main',
        withTagSelect: true,
        subscriptionSourceCount: 1,
        outbounds: [
          {
            code: 'nl-1',
            displayName: 'NL 01',
            type: 'VLESS',
            selected: true,
            latency: 24,
          },
        ],
      },
      onChooseOutbound: () => {},
      onCopyOutbound: () => {},
      onShowUrlTestInfo: () => {},
      onShowPriorityInfo: () => {},
      onTestLatency: () => {},
      onUpdateSubscription: () => {},
      latencyFetching: false,
      subscriptionUpdating: false,
    }) as HTMLElement;
    const headerActionTexts = [
      ...serverCard.querySelectorAll(
        '.fkp_dashboard-page__outbound-section__title-section__actions button',
      ),
    ].map((b) => b.textContent?.trim());
    expect(headerActionTexts[0]).toBe('Test latency');
    expect(headerActionTexts[headerActionTexts.length - 1]).toBe(
      'Добавить сайт',
    );

    const dashboardJs = fs.readFileSync(
      path.join(luciForkopDir, 'dashboard.js'),
      'utf8',
    );
    expect(dashboardJs).toContain('fkp-workspace-sources-actions');

    // 5. Devices & Gaming Presets logical field order, conditional device input, and primary CTA styling
    const { renderDeviceProfileTools } = await import('../../next/tools');
    const toolsRoot = renderDeviceProfileTools(
      async (action) => ({
        success: true,
        data:
          action === 'status'
            ? {
                sections: [
                  { name: 'main', label: 'Main VPN', action: 'connection' },
                ],
              }
            : { items: [{ address: '192.168.1.55', section: 'main' }] },
      }),
      undefined,
      'devices',
    );
    document.body.append(toolsRoot);
    await new Promise((r) => setTimeout(r, 0));

    const openRulesBtn = [...toolsRoot.querySelectorAll('button')].find(
      (b) => b.textContent === 'Открыть условия в правилах',
    )!;
    const deviceList = toolsRoot.querySelector('ul')!;
    expect(
      Boolean(
        deviceList.compareDocumentPosition(openRulesBtn) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      deviceList
        .querySelector('li .fkp-next-item-actions')
        ?.querySelectorAll('button').length,
    ).toBe(2);

    const saveDeviceBtn = [...toolsRoot.querySelectorAll('button')].find(
      (b) => b.textContent === 'Сохранить маршрут устройства',
    )!;
    const applyGamingBtn = [...toolsRoot.querySelectorAll('button')].find(
      (b) => b.textContent === 'Применить игровой пресет',
    )!;
    expect(saveDeviceBtn.classList.contains('fkp-next-primary-action')).toBe(
      true,
    );
    expect(applyGamingBtn.classList.contains('fkp-next-primary-action')).toBe(
      true,
    );

    const presetSelect = toolsRoot.querySelector<HTMLSelectElement>(
      '[aria-label="Игровой пресет"]',
    )!;
    const scopeSelect = toolsRoot.querySelector<HTMLSelectElement>(
      '[aria-label="Охват игрового пресета"]',
    )!;
    const gamingDeviceInput = toolsRoot.querySelector<HTMLInputElement>(
      '[aria-label="Игровое устройство"]',
    )!;
    const consoleCheck = toolsRoot.querySelector<HTMLInputElement>(
      '[data-gaming-console-mode]',
    )!;
    // Preset comes BEFORE Scope
    expect(
      Boolean(
        presetSelect.compareDocumentPosition(scopeSelect) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    // Gaming device input wrapper is hidden until 'selected' scope is chosen
    expect(gamingDeviceInput.closest('label')!.hidden).toBe(true);
    scopeSelect.value = 'selected';
    scopeSelect.dispatchEvent(new Event('change'));
    expect(gamingDeviceInput.closest('label')!.hidden).toBe(false);

    // Selecting 'console' preset auto-checks & locks consoleCheck, restoring when switched back
    presetSelect.value = 'console';
    presetSelect.dispatchEvent(new Event('change'));
    expect(consoleCheck.checked).toBe(true);
    expect(consoleCheck.disabled).toBe(true);
    presetSelect.value = 'playstation';
    presetSelect.dispatchEvent(new Event('change'));
    expect(consoleCheck.disabled).toBe(false);
    expect(consoleCheck.checked).toBe(false);

    // 6. Compatibility panel: comparison action bar precedes result output and highlights primary CTA
    const { renderCompatibilityPanel } = await import(
      '../../next/compatibility'
    );
    const compatRoot = renderCompatibilityPanel(async () => ({
      success: true,
      data: { sections: [{ name: 'main', label: 'Main VPN' }] },
    }));
    const compareBtn = [...compatRoot.querySelectorAll('button')].find(
      (b) => b.textContent === 'Сопоставить настройки',
    )!;
    const refreshConnBtn = [...compatRoot.querySelectorAll('button')].find(
      (b) => b.textContent === 'Обновить подключения',
    )!;
    const compatResult = compatRoot.querySelector('.fkp-next-result')!;
    expect(compareBtn.classList.contains('fkp-next-primary-action')).toBe(true);
    expect(
      Boolean(
        compareBtn.compareDocumentPosition(compatResult) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        refreshConnBtn.compareDocumentPosition(compatResult) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);

    vi.unstubAllGlobals();
  });

  it('Cycle 8 (Action Overflow Menus & Header De-cluttering): tucks secondary/destructive header & row buttons into accessible .fkp-action-menu dropdowns while keeping primary CTAs 1-click', async () => {
    vi.stubGlobal('_', (s: string) => s);
    vi.stubGlobal(
      'E',
      (
        tag: string,
        attrs?: Record<string, unknown> | Node | Node[] | string,
        children?: Node | Node[] | string,
      ) => {
        const el = document.createElement(tag);
        let actualChildren = children;
        if (
          attrs &&
          typeof attrs === 'object' &&
          !Array.isArray(attrs) &&
          !(attrs instanceof Node)
        ) {
          for (const [k, v] of Object.entries(attrs)) {
            if (v === undefined || v === null) continue;
            if (k === 'click' && typeof v === 'function') {
              el.addEventListener('click', v as EventListener);
            } else if (k === 'disabled') {
              if (v) (el as HTMLButtonElement).disabled = true;
            } else {
              el.setAttribute(k, String(v));
            }
          }
        } else {
          actualChildren = attrs as Node | Node[] | string | undefined;
        }
        const appendItem = (c: unknown) => {
          if (c === undefined || c === null || c === '') return;
          if (Array.isArray(c)) c.forEach(appendItem);
          else if (c instanceof Node) el.append(c);
          else el.append(document.createTextNode(String(c)));
        };
        appendItem(actualChildren);
        return el;
      },
    );

    // 1. Shared createActionMenu: keyboard navigation, Escape focus return, single-open exclusivity, auto-close on item click
    const { createActionMenu } = await import('../actionMenu');
    let clicked = 0;
    const itemA = document.createElement('button');
    itemA.type = 'button';
    itemA.textContent = 'Item A';
    itemA.onclick = () => {
      clicked++;
    };
    const itemB = document.createElement('button');
    itemB.type = 'button';
    itemB.textContent = 'Item B';
    const menu1 = createActionMenu('Ещё', [itemA, itemB], {
      ariaLabel: 'Меню 1',
    });
    const itemC = document.createElement('button');
    itemC.type = 'button';
    itemC.textContent = 'Item C';
    const menu2 = createActionMenu('⋯', [itemC], {
      compact: true,
      ariaLabel: 'Меню 2',
    });
    document.body.append(menu1, menu2);

    menu1.open = true;
    menu1.dispatchEvent(new Event('toggle'));
    expect(menu1.open).toBe(true);
    // Opening menu2 closes menu1
    menu2.open = true;
    menu2.dispatchEvent(new Event('toggle'));
    expect(menu1.open).toBe(false);
    expect(menu2.open).toBe(true);

    // Escape closes menu2 and focuses summary
    menu2.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(menu2.open).toBe(false);
    expect(document.activeElement).toBe(menu2.querySelector('summary'));

    // Clicking an enabled item runs its handler and closes menu1
    menu1.open = true;
    menu1.dispatchEvent(new Event('toggle'));
    menu1.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    expect(document.activeElement).toBe(itemA);
    itemA.click();
    expect(clicked).toBe(1);
    expect(menu1.open).toBe(false);

    // 2. Home (renderNextPanel): running service tucks Stop & Refresh inside .fkp-action-menu; stopped service promotes Start button to top-level
    let notifyRuntime!: (s: { running: boolean }) => void;
    const { renderNextPanel } = await import('../../next/render');
    const home = renderNextPanel(
      async () => ({ success: true, data: {} }),
      async () => ({
        success: true,
        data: [
          {
            sectionName: 'main',
            code: 'main-out',
            displayName: 'Main',
            outbounds: [
              { code: 'nl', displayName: 'NL 01', selected: true, latency: 20 },
            ],
          },
        ],
      }),
      {
        workspace: true,
        readRuntime: async () => ({ running: true }),
        subscribeRuntime: (cb) => {
          notifyRuntime = cb;
          return () => {};
        },
        changeService: async () => ({ success: true }),
      },
    );
    document.body.append(home);
    await new Promise((r) => setTimeout(r, 0));

    const heroActions = home.querySelector('.fkp-next-hero-actions')!;
    const changeSrvBtn = [...heroActions.querySelectorAll('button')].find(
      (b) => b.textContent === 'Изменить сервер',
    )!;
    const refreshBtn = [...heroActions.querySelectorAll('button')].find(
      (b) => b.textContent === 'Обновить данные',
    )!;
    const stopBtn = [...heroActions.querySelectorAll('button')].find(
      (b) => b.textContent === 'Отключить сервис',
    )!;
    expect(changeSrvBtn.closest('.fkp-action-menu')).toBeNull();
    expect(refreshBtn.closest('.fkp-action-menu')).not.toBeNull();
    expect(stopBtn.closest('.fkp-action-menu')).not.toBeNull();

    // When service becomes stopped, 'Включить сервис' promotes out of .fkp-action-menu!
    notifyRuntime({ running: false });
    const startBtn = [...heroActions.querySelectorAll('button')].find(
      (b) => b.textContent === 'Включить сервис',
    )!;
    expect(startBtn.closest('.fkp-action-menu')).toBeNull();

    // 3. Servers (renderSections & dashboard.js): Test latency stays top-level; Update subscriptions, Изменить источники & Добавить сайт live in .fkp-action-menu
    const { renderSections } = await import(
      '../../tabs/dashboard/partials/renderSections'
    );
    const serverCard = renderSections({
      loading: false,
      failed: false,
      section: {
        code: 'main-out',
        sectionName: 'main',
        displayName: 'Main',
        withTagSelect: true,
        subscriptionSourceCount: 1,
        outbounds: [
          {
            code: 'nl-1',
            displayName: 'NL 01',
            type: 'VLESS',
            selected: true,
            latency: 24,
          },
        ],
      },
      onChooseOutbound: () => {},
      onCopyOutbound: () => {},
      onShowUrlTestInfo: () => {},
      onShowPriorityInfo: () => {},
      onTestLatency: () => {},
      onUpdateSubscription: () => {},
      latencyFetching: false,
      subscriptionUpdating: false,
    }) as HTMLElement;
    const latencyBtn = serverCard.querySelector(
      '.dashboard-sections-grid-item-test-latency',
    )!;
    const subUpdateBtn = serverCard.querySelector(
      '.fkp_dashboard-page__outbound-section__subscription-update',
    )!;
    const editSourcesBtn = [...serverCard.querySelectorAll('button')].find(
      (b) => b.textContent === 'Изменить источники',
    )!;
    expect(latencyBtn.closest('.fkp-action-menu')).toBeNull();
    expect(subUpdateBtn.closest('.fkp-action-menu')).not.toBeNull();
    expect(editSourcesBtn.closest('.fkp-action-menu')).not.toBeNull();

    // 4. Rules row actions (configureRuleOrder + configureRuleWorkflow): Edit & arrows stay top-level; Добавить сайт & Удалить live in compact .fkp-action-menu
    const { configureRuleOrder } = await import('../rules');
    const ruleTable = document.createElement('div');
    ruleTable.innerHTML =
      '<table><tbody><tr class="tr cbi-section-table-row" data-sid="main"><td class="td cbi-section-table-titles"><span class="fkp-rule-name">Main</span></td><td><input type="checkbox" checked></td><td>Route</td><td class="td cbi-section-actions"><div><button class="cbi-button cbi-button-edit">Изменить</button><button class="cbi-button cbi-button-remove">Удалить</button></div></td></tr></tbody></table>';
    const fakeSection = {
      uciconfig: 'forkop',
      map: {
        config: 'forkop',
        data: { get: () => ({ '.name': 'main' }) },
      },
      renderContents: () => {
        configureRuleOrder(ruleTable, () => true);
        return ruleTable;
      },
      handleAdd: () => {},
      renderMoreOptionsModal: () => {},
      addModalOptions: () => {},
    };
    configureRuleWorkflow(fakeSection as never);
    fakeSection.renderContents();
    const editRuleBtn = ruleTable.querySelector('.cbi-button-edit')!;
    const addSiteBtn = ruleTable.querySelector('.fkp-rule-add-site')!;
    const removeRuleBtn = ruleTable.querySelector('.cbi-button-remove')!;
    expect(editRuleBtn.closest('.fkp-action-menu')).toBeNull();
    expect(addSiteBtn.closest('.fkp-action-menu')).not.toBeNull();
    expect(removeRuleBtn.closest('.fkp-action-menu')).not.toBeNull();

    // 5. Diagnostics right-bar (renderAvailableActions): View logs & Restart stay top-level; config/autostart/stop tucked in .fkp-action-menu
    const { renderAvailableActions } = await import(
      '../../tabs/diagnostic/partials/renderAvailableActions'
    );
    const noop = {
      loading: false,
      visible: true,
      disabled: false,
      onClick: () => {},
    };
    const hidden = { ...noop, visible: false };
    const diagActions = renderAvailableActions({
      restart: noop,
      start: hidden,
      stop: noop,
      enable: hidden,
      disable: noop,
      globalCheck: noop,
      viewLogs: noop,
      showSingBoxConfig: noop,
    }) as HTMLElement;
    const viewLogsBtn = [...diagActions.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'View logs',
    )!;
    const restartBtn = [...diagActions.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Restart Forkop',
    )!;
    const stopForkopBtn = [...diagActions.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Stop Forkop',
    )!;
    expect(viewLogsBtn.closest('.fkp-action-menu')).toBeNull();
    expect(restartBtn.closest('.fkp-action-menu')).toBeNull();
    expect(stopForkopBtn.closest('.fkp-action-menu')).not.toBeNull();

    // 6. Devices (renderDeviceProfileTools): Save device stays top-level; refresh/open-rules & per-row reset tucked in .fkp-action-menu
    const { renderDeviceProfileTools } = await import('../../next/tools');
    const devTools = renderDeviceProfileTools(
      async (act) => ({
        success: true,
        data:
          act === 'status'
            ? {
                sections: [
                  { name: 'main', label: 'Main VPN', action: 'connection' },
                ],
              }
            : { items: [{ address: '192.168.1.55', section: 'main' }] },
      }),
      undefined,
      'devices',
    );
    document.body.append(devTools);
    await new Promise((r) => setTimeout(r, 0));
    const saveDevBtn = [...devTools.querySelectorAll('button')].find(
      (b) => b.textContent === 'Сохранить маршрут устройства',
    )!;
    const openRulesBtn = [...devTools.querySelectorAll('button')].find(
      (b) => b.textContent === 'Открыть условия в правилах',
    )!;
    const resetDevBtn = [...devTools.querySelectorAll('button')].find(
      (b) => b.textContent === 'По общим правилам',
    )!;
    expect(saveDevBtn.closest('.fkp-action-menu')).toBeNull();
    expect(openRulesBtn.closest('.fkp-action-menu')).not.toBeNull();
    expect(resetDevBtn.closest('.fkp-action-menu')).not.toBeNull();

    vi.unstubAllGlobals();
  });

  it('Cycle 9 (Host-Only Theme Inheritance): removes all manual theme switchers across workspace/next/advanced and inherits light/dark strictly from the LuCI host theme', async () => {
    const { mountForkopWorkspace } = await import('../render');
    const { renderNextPanel } = await import('../../next/render');
    const { renderAdvancedPanel } = await import('../../next/advanced');

    const map = buildLuciMapShell();
    const footer = document.createElement('div');
    footer.className = 'cbi-page-actions';
    map.after(footer);
    mountForkopWorkspace(map);

    // Zero manual theme toggle buttons or preference selects in workspace
    expect(map.querySelector('.fkp-workspace-theme-toggle')).toBeNull();
    expect(map.querySelector('[data-workspace-preferences]')).toBeNull();
    expect(map.querySelector('.fkp-workspace-theme')).toBeNull();
    expect(map.textContent).not.toContain('Тёмная тема');
    expect(map.textContent).not.toContain('Светлая тема');
    expect(map.textContent).not.toContain('Предпочтения интерфейса');

    // Zero manual theme selects in standalone Next and Advanced headers
    const standaloneNext = renderNextPanel(async () => ({
      success: true,
      data: {},
    }));
    expect(
      [...standaloneNext.querySelectorAll('label')].some((l) =>
        (l.textContent || '').includes('Тема'),
      ),
    ).toBe(false);

    const standaloneAdv = renderAdvancedPanel(async () => ({
      success: true,
      data: {},
    }));
    expect(
      [...standaloneAdv.querySelectorAll('label')].some((l) =>
        (l.textContent || '').includes('Тема'),
      ),
    ).toBe(false);

    // Follows host LuCI data-darkmode, data-theme, dark classes, and opaque body background luminance
    document.documentElement.setAttribute('data-darkmode', 'true');
    await new Promise((r) => setTimeout(r, 0));
    expect(map.dataset.theme).toBe('dark');
    expect(footer.dataset.theme).toBe('dark');

    document.documentElement.setAttribute('data-darkmode', 'false');
    await new Promise((r) => setTimeout(r, 0));
    expect(map.dataset.theme).toBe('light');
    expect(footer.dataset.theme).toBe('light');

    document.documentElement.removeAttribute('data-darkmode');
    document.body.style.backgroundColor = 'rgb(30, 30, 46)';
    await new Promise((r) => setTimeout(r, 0));
    expect(map.dataset.theme).toBe('dark');

    document.body.style.backgroundColor = 'rgb(248, 250, 252)';
    await new Promise((r) => setTimeout(r, 0));
    expect(map.dataset.theme).toBe('light');
    document.body.style.backgroundColor = '';
  });

  it('Cycle 10 (Deep Surface, CSS Specificity, Mobile Monitoring, Modal Hierarchy & Localization Polish): resolves (1,3,0) button specificity overrides, mobile monitoring flex blowup, symptomGuide initial state, modal CTA hierarchy, single-item overflow menus, server_uuid, and empty states', async () => {
    vi.stubGlobal('_', (s: string) => s);
    vi.stubGlobal(
      'E',
      (
        tag: string,
        attrs?: Record<string, unknown> | Node | Node[] | string,
        children?: Node | Node[] | string,
      ) => {
        const el = document.createElement(tag);
        let actualChildren = children;
        if (
          attrs &&
          typeof attrs === 'object' &&
          !Array.isArray(attrs) &&
          !(attrs instanceof Node)
        ) {
          for (const [k, v] of Object.entries(attrs)) {
            if (v === undefined || v === null || v === false) continue;
            if (k === 'click' && typeof v === 'function') {
              el.addEventListener('click', v as EventListener);
            } else if (k === 'disabled') {
              if (v) (el as HTMLButtonElement).disabled = true;
            } else {
              el.setAttribute(k, String(v));
            }
          }
        } else {
          actualChildren = attrs as Node | Node[] | string | undefined;
        }
        const appendItem = (c: unknown) => {
          if (c === undefined || c === null || c === '') return;
          if (Array.isArray(c)) c.forEach(appendItem);
          else if (c instanceof Node) el.append(c);
          else el.append(document.createTextNode(String(c)));
        };
        appendItem(actualChildren);
        return el;
      },
    );

    const { styles: monitoringStyles } = await import(
      '../../tabs/monitoring/styles'
    );
    const style = document.createElement('style');
    style.dataset.uxFlowStyle = '';
    style.textContent = nextStyles + monitoringStyles + workspaceStyles;
    document.head.append(style);

    // 1. CSS specificity: actionMenu items, monitoring active tab, and selected server button are NOT crushed by #cbi-forkop.fkp-workspace[data-theme] :is(.cbi-button,.btn)
    const ws = document.createElement('div');
    ws.id = 'cbi-forkop';
    ws.className = 'cbi-map fkp-workspace';
    ws.dataset.theme = 'dark';
    ws.innerHTML = `
      <details class="fkp-action-menu" open>
        <summary class="fkp-action-menu__trigger">Ещё</summary>
        <div class="fkp-action-menu__popover">
          <button type="button" class="cbi-button fkp-action-menu__item">Action Item</button>
        </div>
      </details>
      <div class="fkp_monitoring-page">
        <div class="fkp_monitoring-page__tabs">
          <button type="button" class="btn fkp_monitoring-page__tab fkp_monitoring-page__tab--active">Активные</button>
          <button type="button" class="btn fkp_monitoring-page__tab">Закрытые</button>
        </div>
      </div>
      <div class="fkp_dashboard-page__outbound-grid__item">
        <button type="button" class="btn fkp_dashboard-page__outbound-grid__item__select" aria-pressed="true">Выбран</button>
        <button type="button" class="btn fkp_dashboard-page__outbound-grid__item__select" aria-pressed="false">Выбрать</button>
      </div>
    `;
    document.body.append(ws);
    const menuItem = ws.querySelector<HTMLElement>('.fkp-action-menu__item')!;
    const activeMonTab = ws.querySelector<HTMLElement>(
      '.fkp_monitoring-page__tab--active',
    )!;
    const inactiveMonTab = ws.querySelectorAll<HTMLElement>(
      '.fkp_monitoring-page__tab',
    )[1]!;
    const selectedSrvBtn = ws.querySelector<HTMLElement>(
      '.fkp_dashboard-page__outbound-grid__item__select[aria-pressed="true"]',
    )!;
    const unselectedSrvBtn = ws.querySelector<HTMLElement>(
      '.fkp_dashboard-page__outbound-grid__item__select[aria-pressed="false"]',
    )!;
    expect(getComputedStyle(menuItem).background).toContain('transparent');
    expect(getComputedStyle(activeMonTab).backgroundColor).not.toBe(
      getComputedStyle(inactiveMonTab).backgroundColor,
    );
    expect(getComputedStyle(selectedSrvBtn).backgroundColor).not.toBe(
      getComputedStyle(unselectedSrvBtn).backgroundColor,
    );

    // 2. Mobile monitoring flex reset, .control-group flex alignment, .cbi-dropdown 42rem width, and OS dark-mode isolation
    expect(workspaceStyles).toMatch(
      /@media\s*\(max-width:\s*520px\)[\s\S]*fkp_monitoring-page__device-filter[\s\S]*flex:\s*0\s+0\s+auto/,
    );
    expect(workspaceStyles).toContain('.cbi-value-field .control-group');
    expect(workspaceStyles).toContain(
      '.cbi-dropdown:not(.btn):not(.cbi-button)',
    );
    expect(nextStyles).toContain(
      '.fkp-next:not([data-theme=light]):not(.fkp-workspace *)',
    );
    expect(nextStyles).toMatch(/\.fkp-next-content\{[^}]*align-items:\s*start/);

    // 3. symptomGuide initial status is NOT overwritten by invalidate() before user edits
    const { renderSymptomGuide } = await import(
      '../../tabs/diagnostic/symptomGuide'
    );
    const guide = renderSymptomGuide(async () => ({
      success: true,
      data: { sections: [] },
    }));
    const symptomStatus = guide.querySelector('[data-symptom-result]')!;
    expect(symptomStatus.textContent).toBe(
      'Выберите симптом. Проверки запускаются только кнопкой ниже.',
    );
    const symptomSelect = guide.querySelector<HTMLSelectElement>(
      '[name="diagnostic_symptom"]',
    )!;
    symptomSelect.value = 'site';
    symptomSelect.dispatchEvent(new Event('change'));
    expect(symptomStatus.textContent).toBe(
      'Параметры изменены — проверьте снова',
    );

    // 4. Modal CTA hierarchy (Copy primary, Download neutral, Close neutral), Wiki button neutral, SystemInfo omits empty tag
    const { renderModal } = await import('../../../partials/modal/renderModal');
    const modalEl = renderModal('line 1', 'logs');
    const copyBtn = [...modalEl.querySelectorAll('button')].find(
      (b) => b.textContent === 'Copy',
    )!;
    const downloadBtn = [...modalEl.querySelectorAll('button')].find(
      (b) => b.textContent === 'Download',
    )!;
    const closeBtn = [...modalEl.querySelectorAll('button')].find(
      (b) => b.textContent === 'Close',
    )!;
    expect(copyBtn.classList.contains('cbi-button-apply')).toBe(true);
    expect(downloadBtn.classList.contains('cbi-button-apply')).toBe(false);
    expect(closeBtn.classList.contains('cbi-button-remove')).toBe(false);

    const { renderWikiDisclaimer } = await import(
      '../../tabs/diagnostic/partials/renderWikiDisclaimer'
    );
    const wikiEl = renderWikiDisclaimer('default') as HTMLElement;
    expect(
      wikiEl.querySelector('button')!.classList.contains('cbi-button-save'),
    ).toBe(false);

    const { renderSystemInfo } = await import(
      '../../tabs/diagnostic/partials/renderSystemInfo'
    );
    const sysInfoEl = renderSystemInfo({
      items: [
        {
          key: 'Forkop',
          value: '0.8.0',
          tag: { label: 'main', kind: 'success' },
        },
        { key: 'System', value: 'OpenWrt 25.12' },
      ],
    }) as HTMLElement;
    expect(
      sysInfoEl.querySelectorAll(
        '.fkp_diagnostic-page__right-bar__system-info__row__tag',
      ),
    ).toHaveLength(1);

    // 5. No single-item 'Ещё' menus in Advanced/Compatibility/Dashboard; empty <select> placeholders; single-node search hidden
    const { renderAdvancedPanel } = await import('../../next/advanced');
    for (const sec of ['rules', 'diagnostics', 'settings'] as const) {
      const adv = renderAdvancedPanel(
        async () => ({ success: true, data: {} }),
        undefined,
        false,
        sec,
      );
      const refreshBtn = [...adv.querySelectorAll('button')].find(
        (b) => b.textContent === 'Обновить данные',
      )!;
      expect(refreshBtn.closest('.fkp-action-menu')).toBeNull();
      if (sec === 'settings') {
        const profileSel = adv.querySelector<HTMLSelectElement>(
          '[aria-label="Сохранённый профиль"]',
        )!;
        const compatSel = adv.querySelector<HTMLSelectElement>(
          '[aria-label="Сервер для проверки"]',
        )!;
        expect(profileSel.options.length).toBeGreaterThanOrEqual(1);
        expect(compatSel.disabled).toBe(true);
        expect(adv.textContent).toContain('Сначала сопоставьте настройки');
      }
    }

    const { renderSections } = await import(
      '../../tabs/dashboard/partials/renderSections'
    );
    const oneNodeCard = renderSections({
      loading: false,
      failed: false,
      section: {
        code: 'main-out',
        sectionName: 'main',
        displayName: 'Main',
        withTagSelect: true,
        outbounds: [
          {
            code: 'nl-1',
            displayName: 'NL 01',
            type: 'VLESS',
            selected: true,
            latency: 20,
          },
        ],
      },
      onChooseOutbound: () => {},
      onCopyOutbound: () => {},
      onShowUrlTestInfo: () => {},
      onShowPriorityInfo: () => {},
      onTestLatency: () => {},
      onUpdateSubscription: () => {},
      latencyFetching: false,
      subscriptionUpdating: false,
    }) as HTMLElement;
    expect(
      oneNodeCard.querySelector<HTMLElement>('.fkp-node-search')!.hidden,
    ).toBe(true);

    // 6. server_uuid in server.js & formGuide.ts, collapsed advanced group in server modal, localized placeholder in forkop.js, and direct secondary button in dashboard.js
    const serverJs = fs.readFileSync(
      path.join(luciForkopDir, 'server.js'),
      'utf8',
    );
    const forkopJs = fs.readFileSync(
      path.join(luciForkopDir, 'forkop.js'),
      'utf8',
    );
    const dashboardJs = fs.readFileSync(
      path.join(luciForkopDir, 'dashboard.js'),
      'utf8',
    );
    expect(serverJs).toContain('"server_uuid"');
    expect(forkopJs).toContain('renderSectionPlaceholder');
    expect(dashboardJs).not.toContain('createActionMenu("Ещё", [edit]');

    const serverModalScope = document.createElement('div');
    serverModalScope.className = 'fkp-workspace-modal';
    const serverModalInner = document.createElement('div');
    serverModalInner.className = 'cbi-section-node';
    for (const key of [
      'enabled',
      'protocol',
      'server_port',
      'server_uuid',
      'tls_mode',
      'mtproto_max_connections',
      'reality_max_time_difference',
    ]) {
      const row = document.createElement('div');
      row.className = 'cbi-value';
      row.id = `cbi-forkop-srv1-${key}`;
      serverModalInner.append(row);
    }
    serverModalScope.append(serverModalInner);
    enhanceForkopForms(serverModalScope);
    const credGroup = [
      ...serverModalInner.querySelectorAll('.fkp-form-group'),
    ].find((g) => g.textContent?.includes('Учётные данные'))!;
    expect(
      credGroup.querySelector('#cbi-forkop-srv1-server_uuid'),
    ).not.toBeNull();
    const advServerDetails = [
      ...serverModalInner.querySelectorAll<HTMLDetailsElement>(
        'details.fkp-form-group',
      ),
    ].find((g) =>
      g
        .querySelector('summary')
        ?.textContent?.includes('Дополнительные параметры'),
    );
    expect(advServerDetails).toBeDefined();
    expect(advServerDetails!.open).toBe(false);

    vi.unstubAllGlobals();
  });
});
