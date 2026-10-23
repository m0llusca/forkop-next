import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  connections: vi.fn(),
  subscribe: vi.fn(),
  clock: 1000,
}));
vi.mock('../../../../helpers', async () => ({
  ...(await import('../../../../helpers/getClashApiUrl')),
  onMount: async () => undefined,
}));
vi.mock('../../../methods', () => ({
  CustomForkopMethods: {
    getConfigSections: mocks.config,
    getDashboardSections: async () => ({ success: true, data: [] }),
  },
  ForkopShellMethods: { getClashApiConnections: mocks.connections },
}));
vi.mock('../../../methods/custom/getConfigSections', () => ({
  getConfigSections: mocks.config,
}));
vi.mock('../../../services/runtimeUiState.service', () => ({
  getCachedRuntimeUiState: () => true,
  refreshRuntimeUiState: async () => undefined,
  subscribeRuntimeUiState: () => () => undefined,
}));
vi.mock('../../../fetchers/fetchServicesInfo', () => ({
  fetchServicesInfo: vi.fn(),
}));
vi.mock('../partials', () => ({}));
vi.mock('../../../helpers/isActiveLuciTab', () => ({
  isActiveLuciTab: () => false,
}));

describe('dashboard private-controller telemetry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('../../../services', async () => ({
      store: (await import('../../../services/store.service')).store,
      logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
      socket: { subscribe: mocks.subscribe, resetAll: vi.fn() },
    }));

    vi.useFakeTimers();
    mocks.clock = 1000;
    vi.stubGlobal('performance', { now: () => mocks.clock });
    mocks.config.mockReset().mockResolvedValue([]);
    mocks.connections.mockReset().mockResolvedValue(snapshot(1000, 2000));
    mocks.subscribe.mockReset();
    vi.stubGlobal('window', {
      location: { hostname: 'router.example', protocol: 'http:' },
      addEventListener: vi.fn(),
    });
    vi.stubGlobal('document', { hidden: false, getElementById: () => null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function snapshot(downloadTotal: number, uploadTotal: number) {
    return {
      success: true,
      data: {
        downloadTotal,
        uploadTotal,
        connections: [{ id: '1' }, { id: '2' }],
        memory: 4096,
      },
    };
  }

  async function mount(settings: Record<string, string | undefined> = {}) {
    mocks.config.mockResolvedValue([
      { '.name': 'settings', '.type': 'settings', ...settings },
    ]);
    return mountWithCurrentConfig();
  }
  async function mountWithCurrentConfig() {
    const { store } = await import('../../../services/store.service');
    store.set({
      tabService: { current: 'dashboard', all: [] },
      servicesInfoWidget: {
        loading: false,
        failed: false,
        data: {
          singbox: 1,
          forkopRunning: 1,
          forkopEnabled: 1,
          forkopStatus: 'running',
        },
      },
    });
    const { initController } = await import('../initController');
    await initController();
    await vi.advanceTimersByTimeAsync(0);
    return store;
  }

  it.each([
    {},
    { enable_yacd: '0', yacd_secret_key: 'secret' },
    { enable_yacd: '1', yacd_secret_key: '' },
  ])('updates telemetry via RPC for private settings: %j', async (settings) => {
    const store = await mount(settings);
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(mocks.connections).toHaveBeenCalledTimes(1);
    expect(store.get().trafficTotalWidget.data).toEqual({
      downloadTotal: 1000,
      uploadTotal: 2000,
    });
    expect(store.get().systemInfoWidget.data).toEqual({
      connections: 2,
      memory: 4096,
    });
    expect(store.get().bandwidthWidget.data).toEqual({ down: 0, up: 0 });
    mocks.connections.mockResolvedValue(snapshot(10000, 5000));
    mocks.clock = 4000;
    await vi.advanceTimersByTimeAsync(3000);
    expect(store.get().bandwidthWidget.data).toEqual({ down: 3000, up: 1000 });
  });

  it('retains authenticated HTTP websockets with lossless encoded secrets', async () => {
    const store = await mount({
      enable_yacd: '1',
      yacd_secret_key: 'a&b?c#d+e',
    });
    expect(mocks.connections).not.toHaveBeenCalled();
    expect(mocks.subscribe).toHaveBeenCalledTimes(2);
    const urls = mocks.subscribe.mock.calls.map((call) => new URL(call[0]));
    expect(urls.map((url) => url.pathname)).toEqual([
      '/traffic',
      '/connections',
    ]);
    expect(urls.map((url) => url.searchParams.get('token'))).toEqual([
      'a&b?c#d+e',
      'a&b?c#d+e',
    ]);
    mocks.subscribe.mock.calls[0][1](JSON.stringify({ up: 12, down: 34 }));
    mocks.subscribe.mock.calls[1][1](JSON.stringify(snapshot(1000, 2000).data));
    expect(store.get().bandwidthWidget.data).toEqual({ up: 12, down: 34 });
    expect(store.get().systemInfoWidget.data.connections).toBe(2);
  });

  it('uses RPC from HTTPS even when remote access is enabled', async () => {
    vi.stubGlobal('window', {
      location: { hostname: 'router.example', protocol: 'https:' },
      addEventListener: vi.fn(),
    });
    await mount({ enable_yacd: '1', yacd_secret_key: 'secret' });
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(mocks.connections).toHaveBeenCalledTimes(1);
  });

  it('continues via RPC when settings cannot be loaded', async () => {
    mocks.config.mockRejectedValue(new Error('uci unavailable'));
    const store = await mountWithCurrentConfig();
    expect(mocks.connections).toHaveBeenCalledTimes(1);
    expect(store.get().trafficTotalWidget.failed).toBe(false);
  });

  it('resets rate after counters reset or the monotonic clock does not advance', async () => {
    const store = await mount();
    mocks.connections.mockResolvedValue(snapshot(10, 20));
    mocks.clock = 4000;
    await vi.advanceTimersByTimeAsync(3000);
    expect(store.get().bandwidthWidget.data).toEqual({ up: 0, down: 0 });
    mocks.connections.mockResolvedValue(snapshot(40, 50));
    await vi.advanceTimersByTimeAsync(3000);
    expect(store.get().bandwidthWidget.data).toEqual({ up: 0, down: 0 });
    mocks.clock = 7000;
    mocks.connections.mockResolvedValue(snapshot(3040, 6050));
    await vi.advanceTimersByTimeAsync(3000);
    expect(store.get().bandwidthWidget.data).toEqual({ up: 2000, down: 1000 });
  });

  it('never overlaps slow RPC calls and drops their result after stop', async () => {
    let resolve!: (response: ReturnType<typeof snapshot>) => void;
    mocks.connections.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const store = await mount();
    await vi.advanceTimersByTimeAsync(9000);
    expect(mocks.connections).toHaveBeenCalledTimes(1);
    const current = store.get().servicesInfoWidget;
    store.set({
      servicesInfoWidget: {
        ...current,
        data: { ...current.data, forkopRunning: 0 },
      },
    });
    resolve(snapshot(50000, 60000));
    await vi.advanceTimersByTimeAsync(9000);
    expect(mocks.connections).toHaveBeenCalledTimes(1);
    expect(store.get().trafficTotalWidget.data).toEqual({
      downloadTotal: 0,
      uploadTotal: 0,
    });
  });

  it('starts telemetry after an unavailable service becomes running', async () => {
    const store = await mount();
    const current = store.get().servicesInfoWidget;
    store.set({
      servicesInfoWidget: {
        ...current,
        data: { ...current.data, forkopRunning: 0 },
      },
    });
    store.set({ servicesInfoWidget: { ...current, failed: true } });
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.connections).toHaveBeenCalledTimes(1);
    store.set({ servicesInfoWidget: current });
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.connections).toHaveBeenCalledTimes(2);
  });

  it('recovers after an RPC error without deriving a rate from stale counters', async () => {
    const store = await mount();
    mocks.connections.mockResolvedValue({
      success: false,
      error: 'unavailable',
    });
    mocks.clock = 4000;
    await vi.advanceTimersByTimeAsync(3000);
    expect(store.get().bandwidthWidget.failed).toBe(true);
    expect(store.get().trafficTotalWidget.failed).toBe(true);
    mocks.connections.mockResolvedValue(snapshot(100000, 200000));
    mocks.clock = 7000;
    await vi.advanceTimersByTimeAsync(3000);
    expect(store.get().bandwidthWidget).toEqual({
      loading: false,
      failed: false,
      data: { up: 0, down: 0 },
    });
    expect(store.get().trafficTotalWidget.data).toEqual({
      downloadTotal: 100000,
      uploadTotal: 200000,
    });
  });

  it('skips hidden pages and stops polling when the dashboard unmounts', async () => {
    const store = await mount();
    Object.assign(document, { hidden: true });
    await vi.advanceTimersByTimeAsync(6000);
    expect(mocks.connections).toHaveBeenCalledTimes(1);
    Object.assign(document, { hidden: false });
    mocks.clock = 10000;
    await vi.advanceTimersByTimeAsync(3000);
    expect(mocks.connections).toHaveBeenCalledTimes(2);
    store.set({ tabService: { current: 'monitoring', all: [] } });
    await vi.advanceTimersByTimeAsync(6000);
    expect(mocks.connections).toHaveBeenCalledTimes(2);
  });
});
