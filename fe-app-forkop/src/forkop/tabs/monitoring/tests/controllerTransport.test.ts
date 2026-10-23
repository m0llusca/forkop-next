// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const nativeDocument = document;

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  connections: vi.fn(),
  subscribe: vi.fn(),
  onService: undefined as undefined | ((state: unknown) => void),
}));
vi.mock('../../../../helpers', async () => ({
  ...(await import('../../../../helpers/getClashApiUrl')),
  ...(await import('../../../../helpers/svgEl')),
  onMount: async () => undefined,
}));
vi.mock('../../../methods', () => ({
  CustomForkopMethods: { getConfigSections: mocks.config },
  ForkopShellMethods: { getClashApiConnections: mocks.connections },
}));
vi.mock('../../../methods/custom/getConfigSections', () => ({
  getConfigSections: mocks.config,
}));
vi.mock('../../../services', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
  socket: { subscribe: mocks.subscribe, disconnect: vi.fn() },
  store: {
    get: () => ({ tabService: { current: 'monitoring' } }),
    subscribe: vi.fn(),
  },
}));
vi.mock('../../../services/runtimeUiState.service', () => ({
  getCachedRuntimeUiState: () => true,
  refreshRuntimeUiState: async () => undefined,
  subscribeRuntimeUiState: (callback: (state: unknown) => void) => {
    mocks.onService = callback;
    callback({ service: { forkop: { running: true } } });
    return () => undefined;
  },
}));

describe('monitoring controller transport', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    mocks.config.mockReset();
    mocks.connections
      .mockReset()
      .mockResolvedValue({ success: true, data: { connections: [] } });
    mocks.subscribe.mockReset();
    vi.stubGlobal('window', {
      location: { hostname: 'router.example', protocol: 'http:' },
    });
    vi.stubGlobal('document', {
      getElementById: () => null,
      querySelector: () => null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });
  afterEach(() => {
    nativeDocument.body.replaceChildren();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function mount(settings: Record<string, string | undefined>) {
    mocks.config.mockResolvedValue([
      { '.name': 'settings', '.type': 'settings', ...settings },
    ]);
    const { initController } = await import('../initController');
    await initController();
    await vi.advanceTimersByTimeAsync(0);
  }

  it.each([
    {},
    { enable_yacd: '0', yacd_secret_key: 'secret' },
    { enable_yacd: '1', yacd_secret_key: '' },
  ])(
    'polls rpcd immediately and repeatedly for private controllers: %j',
    async (settings) => {
      await mount(settings);
      expect(mocks.connections).toHaveBeenCalledTimes(1);
      expect(mocks.subscribe).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1500);
      expect(mocks.connections).toHaveBeenCalledTimes(2);
    },
  );

  it('subscribes directly for an authenticated exposed controller and preserves the token', async () => {
    await mount({ enable_yacd: '1', yacd_secret_key: 'a&b?c#d+e' });
    expect(mocks.connections).not.toHaveBeenCalled();
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
    const url = new URL(mocks.subscribe.mock.calls[0][0]);
    expect(url.origin).toBe('ws://router.example:9090');
    expect(url.searchParams.get('token')).toBe('a&b?c#d+e');
  });

  it('falls back to rpcd if settings cannot be loaded', async () => {
    mocks.config.mockRejectedValue(new Error('uci unavailable'));
    const { initController } = await import('../initController');
    await initController();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.connections).toHaveBeenCalledTimes(1);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it('does not start a transport after the service stops while loading settings', async () => {
    let resolveConfig!: (value: unknown[]) => void;
    mocks.config.mockReturnValue(
      new Promise((resolve) => {
        resolveConfig = resolve;
      }),
    );
    const { initController } = await import('../initController');
    await initController();
    await vi.advanceTimersByTimeAsync(0);
    mocks.onService?.({ service: { forkop: { running: false } } });
    resolveConfig([
      {
        '.name': 'settings',
        '.type': 'settings',
        enable_yacd: '1',
        yacd_secret_key: 'secret',
      },
    ]);
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.connections).not.toHaveBeenCalled();
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it('keeps HTTPS on rpcd even for an authenticated exposed controller', async () => {
    vi.stubGlobal('window', {
      location: { hostname: 'router.example', protocol: 'https:' },
    });
    await mount({ enable_yacd: '1', yacd_secret_key: 'secret' });
    expect(mocks.connections).toHaveBeenCalledTimes(1);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it.each(['success', 'failure'])(
    'drops a pre-stop RPC %s after restart without overlapping requests',
    async (outcome) => {
      vi.stubGlobal('document', nativeDocument);
      vi.stubGlobal(
        'E',
        (
          tag: string,
          attributes: Record<string, string>,
          children: Node | string | (Node | string)[],
        ) => {
          const node = nativeDocument.createElement(tag);
          for (const [key, value] of Object.entries(attributes))
            node.setAttribute(key, value);
          node.append(...(Array.isArray(children) ? children : [children]));
          return node;
        },
      );
      const container = nativeDocument.createElement('div');
      container.id = 'monitoring-connections';
      nativeDocument.body.append(container);
      let resolveOld!: (value: unknown) => void;
      let rejectOld!: (error: Error) => void;
      const snapshot = (id: string, host: string) => ({
        success: true,
        data: {
          connections: [
            {
              id,
              metadata: {
                host,
                destinationPort: 443,
                network: 'tcp',
                sourceIP: '192.0.2.1',
              },
              download: 1,
              upload: 2,
              chains: ['direct'],
              start: '2026-10-23T00:00:00Z',
            },
          ],
        },
      });
      mocks.connections.mockReturnValueOnce(
        new Promise((resolve, reject) => {
          resolveOld = resolve;
          rejectOld = reject;
        }),
      );
      await mount({});
      expect(mocks.connections).toHaveBeenCalledTimes(1);
      mocks.onService?.({ service: { forkop: { running: false } } });
      mocks.onService?.({ service: { forkop: { running: true } } });
      await vi.advanceTimersByTimeAsync(3000);
      expect(mocks.connections).toHaveBeenCalledTimes(1);
      if (outcome === 'success')
        resolveOld(snapshot('old', 'old-session.example'));
      else rejectOld(new Error('old RPC failed'));
      await vi.advanceTimersByTimeAsync(0);
      expect(container.textContent).not.toContain('old-session.example');
      expect(container.textContent).toContain('Loading connections');
      mocks.connections.mockResolvedValue(
        snapshot('new', 'new-session.example'),
      );
      await vi.advanceTimersByTimeAsync(1500);
      expect(mocks.connections).toHaveBeenCalledTimes(2);
      expect(container.textContent).toContain('new-session.example');
    },
  );
});
