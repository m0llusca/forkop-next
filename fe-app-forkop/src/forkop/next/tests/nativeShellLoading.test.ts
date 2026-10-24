// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
const tick = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
const capabilities = {
  sing_box_extended: 1,
  sing_box_tiny: 0,
  sing_box_tailscale: 1,
  zapret_installed: 1,
  zapret2_installed: 0,
  byedpi_installed: 0,
  server_inbounds_enabled_count: 1,
};
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function setup(shell: Record<string, unknown>) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const maps: NativeMap[] = [];
  const settingsParse = vi.fn(async () => {});
  class NativeSection {
    children: Array<Record<string, unknown>> = [];
    constructor(
      public map: NativeMap,
      public sectiontype: string,
      public title: string,
    ) {}
    option(_type: unknown, name: string) {
      const o = { option: name, cfgvalue: () => '', parse: async () => {} };
      this.children.push(o);
      return o;
    }
    async load() {
      return Promise.all(
        this.children.map((o) =>
          typeof o.load === 'function' ? o.load('settings') : undefined,
        ),
      );
    }
    async parse() {
      if (this.sectiontype === 'settings') settingsParse();
    }
    async render() {
      const pane = document.createElement('section');
      pane.className = 'cbi-section';
      pane.dataset.tab = this.sectiontype;
      pane.dataset.tabActive = this.sectiontype === 'next' ? 'true' : 'false';
      for (const o of this.children) {
        const result = (o.cfgvalue as () => unknown)?.();
        if (result instanceof Node) pane.append(result);
        else pane.append(document.createTextNode(String(result || '')));
      }
      return pane;
    }
  }
  class NativeMap {
    children: NativeSection[] = [];
    root!: HTMLElement;
    tabbed = false;
    nativeSaveApply = vi.fn(async function (
      this: NativeMap,
      _e: unknown,
      _m: unknown,
    ) {
      await this.parse();
      return 'saved';
    });
    handleSaveApply = this.nativeSaveApply;
    constructor(..._args: unknown[]) {
      maps.push(this);
    }
    section(_type: unknown, type: string, title: string) {
      const section = new NativeSection(this, type, title);
      this.children.push(section);
      return section;
    }
    async parse() {
      await Promise.all(this.children.map((s) => s.parse()));
    }
    findElement(name: string, value?: string) {
      return this.root.querySelector<HTMLElement>(
        value === undefined ? name : `[${name}="${value}"]`,
      );
    }
    checkDepends = vi.fn();
    async render() {
      this.root = document.createElement('div');
      this.root.className = 'cbi-map';
      const menu = document.createElement('ul');
      menu.className = 'cbi-tabmenu';
      const panes = document.createElement('div');
      panes.className = 'cbi-map-tabbed';
      this.root.append(menu, panes);
      for (const s of this.children) {
        await s.load();
        panes.append(await s.render());
        const item = document.createElement('li');
        item.dataset.tab = s.sectiontype;
        item.className =
          s.sectiontype === 'next' ? 'cbi-tab' : 'cbi-tab-disabled';
        const link = document.createElement('a');
        link.textContent = s.title;
        item.append(link);
        menu.append(item);
        link.onclick = () => {
          for (const tab of [...menu.children])
            tab.className =
              tab.getAttribute('data-tab') === s.sectiontype
                ? 'cbi-tab'
                : 'cbi-tab-disabled';
          for (const pane of [...panes.children])
            pane.setAttribute(
              'data-tab-active',
              String(pane.getAttribute('data-tab') === s.sectiontype),
            );
        };
      }
      return this.root;
    }
  }
  const settings = {
    createSettingsContent: vi.fn((s: NativeSection, c: unknown) => {
      const o = s.option(null, 'actual_setting');
      o.cfgvalue = () => `Real settings ${JSON.stringify(c)}`;
    }),
  };
  const server = {
    configureServerSection: vi.fn(),
    createServerContent: vi.fn(),
    applyServerCapabilities: vi.fn(),
  };
  const section = {
    configureSectionSection: vi.fn(),
    createSectionContent: vi.fn(),
  };
  const main = {
    FORKOP_UCI_PACKAGE: 'forkop',
    FORKOP_ACTION_PROVIDERS_AVAILABILITY_EVENT: 'providers',
    ForkopShellMethods: {
      getUiState: async () => ({ success: false }),
      ...shell,
    },
    injectGlobalStyles: vi.fn(),
    registerConfigurationReload: vi.fn(),
    coreService: vi.fn(),
    applyUiStateToStore: vi.fn(),
  };
  const feature = {
    createDiagnosticContent: vi.fn(),
    createDashboardContent: vi.fn(),
    createMonitoringContent: vi.fn(),
    createUpdatesContent: vi.fn(),
  };
  const next = {
    createNextContent: (s: NativeSection) => {
      const o = s.option(null, 'overview');
      o.cfgvalue = () => 'Essential overview';
    },
  };
  const source = readFileSync(
    '../luci-app-forkop/htdocs/luci-static/resources/view/forkop/forkop.js',
    'utf8',
  );
  const controller = new Function(
    'view',
    'form',
    'baseclass',
    'uci',
    'ui',
    'main',
    'next',
    'settings',
    'section',
    'server',
    'dashboard',
    'monitoring',
    'diagnostic',
    'updates',
    '_',
    source,
  )(
    { extend: (v: unknown) => v },
    {
      Map: NativeMap,
      TypedSection: NativeSection,
      GridSection: NativeSection,
      TableSection: NativeSection,
      DummyValue: 'dummy',
    },
    {},
    {},
    {},
    main,
    next,
    settings,
    section,
    server,
    feature,
    feature,
    feature,
    feature,
    (s: string) => s,
  );
  return { controller, maps, settings, server, section, main, settingsParse };
}
it('renders the essential native page without waiting for pending capabilities and preserves settings on unrelated saves', async () => {
  const state = setup({ getUiCapabilities: () => new Promise(() => {}) });
  let rendered: HTMLElement | undefined;
  void state.controller.render().then((r: HTMLElement) => {
    rendered = r;
  });
  await tick();
  expect(rendered?.textContent).toContain('Essential overview');
  expect(state.settings.createSettingsContent).not.toHaveBeenCalled();
  expect(rendered?.textContent).toContain('Проверяем возможности');
  await state.maps[0].parse();
  expect(state.settingsParse).not.toHaveBeenCalled();
  expect(state.main.coreService).toHaveBeenCalledOnce();
});
it('mounts settings with real capabilities after first paint without replacing unrelated fields', async () => {
  let finish!: (r: unknown) => void;
  const state = setup({
    getUiCapabilities: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const pending = state.controller.render();
  await tick();
  const map = state.maps[0];
  expect(map.root).toBeDefined();
  const rendered = await pending;
  document.body.append(rendered);
  const rules = map.findElement(
    '.cbi-map-tabbed > .cbi-section[data-tab="section"]',
  )!;
  rules.append(document.createTextNode('unsaved rule'));
  finish({ success: true, data: capabilities });
  await tick();
  expect(state.settings.createSettingsContent).toHaveBeenCalledOnce();
  expect(rendered.textContent).toContain('Real settings');
  expect(rendered.textContent).toContain('unsaved rule');
  expect(
    map.findElement('.cbi-map-tabbed > .cbi-section[data-tab="settings"]')
      ?.dataset.tabActive,
  ).toBe('false');
  await map.parse();
  expect(state.settingsParse).toHaveBeenCalledOnce();
  const providerLoader =
    state.section.configureSectionSection.mock.calls[0][1]
      .loadActionProvidersAvailability;
  expect((await providerLoader()).zapretInstalled).toBe(true);
});
it('replaces only the native settings pane while preserving its menu, tab activation and unsaved rules', async () => {
  let finish!: (r: unknown) => void;
  const state = setup({
    getUiCapabilities: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const rendered: HTMLElement = await state.controller.render();
  document.body.append(rendered);
  const menu = rendered.querySelector('.cbi-tabmenu')!;
  const settingsTab = menu.querySelector<HTMLElement>('[data-tab="settings"]')!;
  const settingsLink = settingsTab.querySelector('a')!;
  const rulesLink = menu.querySelector<HTMLAnchorElement>(
    '[data-tab="section"] a',
  )!;
  const placeholder = rendered.querySelector(
    '.cbi-map-tabbed > .cbi-section[data-tab="settings"]',
  )!;
  const rules = rendered.querySelector(
    '.cbi-map-tabbed > .cbi-section[data-tab="section"]',
  )!;
  const draft = document.createElement('input');
  draft.value = 'unsaved rule edit';
  rules.append(draft);
  settingsLink.click();
  expect(placeholder.getAttribute('data-tab-active')).toBe('true');
  finish({ success: true, data: capabilities });
  await tick();
  expect(rendered.querySelector('.cbi-tabmenu')).toBe(menu);
  expect(menu.querySelector('[data-tab="settings"]')).toBe(settingsTab);
  const actual = rendered.querySelector(
    '.cbi-map-tabbed > .cbi-section[data-tab="settings"]',
  )!;
  expect(actual).not.toBe(placeholder);
  expect(actual.textContent).toContain('Real settings');
  expect(actual.getAttribute('data-tab-active')).toBe('true');
  expect(
    rendered.querySelectorAll(
      '.cbi-map-tabbed > .cbi-section[data-tab="settings"]',
    ),
  ).toHaveLength(1);
  rulesLink.click();
  expect(actual.getAttribute('data-tab-active')).toBe('false');
  expect(rules.contains(draft)).toBe(true);
  expect(draft.value).toBe('unsaved rule edit');
  settingsLink.click();
  expect(actual.getAttribute('data-tab-active')).toBe('true');
  expect(
    rendered.querySelectorAll(
      '.cbi-map-tabbed > .cbi-section[data-tab-active="true"]',
    ),
  ).toHaveLength(1);
});
it('keeps failed capability discovery unknown, exposes retry and preserves unrelated save semantics', async () => {
  const failed = vi.fn(async () => ({ success: false, error: 'offline' }));
  const state = setup({
    getUiCapabilities: failed,
    getUiState: failed,
    getServerCapabilities: failed,
    checkZapretRuntime: failed,
    checkZapret2Runtime: failed,
    checkByedpiRuntime: failed,
    checkInboundsConfig: failed,
  });
  const pending = state.controller.render();
  await tick();
  const rendered = await pending;
  document.body.append(rendered);
  await tick();
  expect(state.settings.createSettingsContent).not.toHaveBeenCalled();
  expect(rendered.textContent).toContain('Не удалось проверить возможности');
  const retry = [...rendered.querySelectorAll('button')].find(
    (b) => b.textContent === 'Повторить проверку',
  )!;
  expect(retry).toBeDefined();
  const before = failed.mock.calls.length;
  retry.click();
  await tick();
  expect(failed.mock.calls.length).toBeGreaterThan(before);
  await state.maps[0].parse();
  expect(state.settingsParse).not.toHaveBeenCalled();
});
it('retains UI state fallback evidence and existing server/provider capability loaders', async () => {
  const state = setup({
    getUiCapabilities: async () => ({ success: false }),
    getUiState: async () => ({
      success: true,
      data: { capabilities, service: {} },
    }),
  });
  const rendered = await state.controller.render();
  document.body.append(rendered);
  await tick();
  expect(state.settings.createSettingsContent).toHaveBeenCalledOnce();
  expect(state.main.applyUiStateToStore).toHaveBeenCalledOnce();
  const loader =
    state.server.configureServerSection.mock.calls[0][1].loadCapabilities;
  expect((await loader()).singBoxExtended).toBe(true);
});
it('retains independent runtime fallback detection when primary and UI state calls fail', async () => {
  const failed = async () => ({ success: false });
  const state = setup({
    getUiCapabilities: failed,
    getUiState: failed,
    getServerCapabilities: async () => ({
      success: true,
      data: { sing_box_extended: 1, sing_box_tiny: 0, sing_box_tailscale: 0 },
    }),
    checkZapretRuntime: async () => ({
      success: true,
      data: { zapret_installed: 1 },
    }),
    checkZapret2Runtime: async () => ({
      success: true,
      data: { zapret2_installed: 0 },
    }),
    checkByedpiRuntime: async () => ({
      success: true,
      data: { byedpi_installed: 0 },
    }),
    checkInboundsConfig: async () => ({
      success: true,
      data: { enabled_count: 2 },
    }),
  });
  const rendered = await state.controller.render();
  document.body.append(rendered);
  await tick();
  const loader =
    state.server.configureServerSection.mock.calls[0][1].loadCapabilities;
  const caps = await loader();
  expect(caps.singBoxTailscale).toBe(false);
  expect(caps.zapretInstalled).toBe(true);
  expect(caps.serverInboundsEnabledCount).toBe(2);
  expect(state.settings.createSettingsContent).toHaveBeenCalledOnce();
});
it('preserves original Save and Apply arguments, return value and failure semantics before capabilities resolve', async () => {
  const state = setup({ getUiCapabilities: () => new Promise(() => {}) });
  const rendered = await state.controller.render();
  document.body.append(rendered);
  const map = state.maps[0];
  const event = { type: 'apply' };
  expect(await map.handleSaveApply(event, 'checked')).toBe('saved');
  expect(map.nativeSaveApply).toHaveBeenCalledExactlyOnceWith(event, 'checked');
  expect(state.settingsParse).not.toHaveBeenCalled();
  map.nativeSaveApply.mockRejectedValueOnce(Error('save failed'));
  await expect(map.handleSaveApply(event, 'checked')).rejects.toThrow(
    'save failed',
  );
});
it('does not fabricate feature evidence from malformed successful capability responses', async () => {
  const failed = async () => ({ success: false });
  const state = setup({
    getUiCapabilities: async () => ({ success: true, data: {} }),
    getUiState: failed,
    getServerCapabilities: failed,
    checkZapretRuntime: failed,
    checkZapret2Runtime: failed,
    checkByedpiRuntime: failed,
    checkInboundsConfig: failed,
  });
  const rendered = await state.controller.render();
  document.body.append(rendered);
  await tick();
  expect(state.settings.createSettingsContent).not.toHaveBeenCalled();
  expect(state.server.applyServerCapabilities).not.toHaveBeenCalled();
  expect(rendered.textContent).toContain('Не удалось проверить возможности');
});
it('does not parse newly created settings until their asynchronous load and mount finish', async () => {
  let finish!: () => void;
  const state = setup({
    getUiCapabilities: async () => ({ success: true, data: capabilities }),
  });
  state.settings.createSettingsContent.mockImplementation((s) => {
    const field = s.option(null, 'actual_setting');
    field.cfgvalue = () => 'Mounted settings';
    Object.assign(field, {
      load: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    });
  });
  const rendered = await state.controller.render();
  document.body.append(rendered);
  await tick();
  await state.maps[0].parse();
  expect(state.settingsParse).not.toHaveBeenCalled();
  finish();
  await tick();
  expect(rendered.textContent).toContain('Mounted settings');
  await state.maps[0].parse();
  expect(state.settingsParse).toHaveBeenCalledOnce();
});
