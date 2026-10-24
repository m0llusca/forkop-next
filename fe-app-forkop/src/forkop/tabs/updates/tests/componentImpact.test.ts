// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { store } from '../../../services/store.service';
const boundary = vi.hoisted(() => ({ start: vi.fn(), execute: vi.fn() }));
vi.mock('../../../../helpers', async () => ({
  ...(await vi.importActual('../../../../helpers')),
  onMount: async () => undefined,
  preserveScrollForPage: (work: () => void) => work(),
}));
vi.mock('../../../../helpers/executeShellCommand', () => ({
  executeShellCommand: boundary.execute,
}));
vi.mock('../../../services/systemInfo.service', () => ({
  ensureSystemInfo: async () => undefined,
}));
vi.mock('../../../services/runtimeUiState.service', () => ({
  getCachedRuntimeUiState: () => null,
  refreshRuntimeUiState: async () => null,
  subscribeRuntimeUiState: () => () => undefined,
}));
vi.mock('../../../methods', async () => ({
  ...(await vi.importActual('../../../methods')),
  ForkopShellMethods: {
    componentUpdateCheckCache: async () => ({
      success: true,
      data: { enabled: false, results: [] },
    }),
    componentActionStart: boundary.start,
    componentActionState: async () => ({ success: true, data: [] }),
    uiActionAck: async () => ({ success: true }),
    waitComponentActionJob: async (
      _job: string,
      component: string,
      action: string,
    ) => ({
      success: true,
      data: {
        success: true,
        component,
        action,
        changed: true,
        current_version: '1.15.0',
        latest_version: '1.15.0',
        message: 'installed',
      },
    }),
  },
}));
const tick = async () => {
  for (let i = 0; i < 80; i++) await Promise.resolve();
};
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  store.reset();
});
function nativeElement(
  tag: string,
  attrs: Record<string, unknown> = {},
  children?: unknown,
): HTMLElement {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'function')
      node.addEventListener(key, value as EventListener);
    else if (value != null && value !== false)
      node.setAttribute(key, String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child instanceof Node) node.append(child);
    else if (child != null) node.append(String(child));
  }
  return node;
}
const click = (name: string) =>
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent?.includes(name))!
    .click();
it.each([
  ['official', '1.99.0-extended', 'Tiny', 'install_tiny', 'tiny'],
  ['forkop-next-record', '2.0.0-record', 'Stable', 'install_stable', 'stable'],
])(
  'keeps cached %s release evidence out of a %s target preview and retains explicit guarded installation',
  async (source, cachedVersion, selected, action, variant) => {
    vi.resetModules();
    vi.stubGlobal('E', nativeElement);
    vi.stubGlobal('ui', {
      showModal: (_title: string, content: HTMLElement) =>
        document.body.append(content),
      hideModal: () => undefined,
    });
    boundary.start.mockReset().mockResolvedValue({
      success: true,
      data: { job_id: 'job-preview', success: true },
    });
    boundary.execute.mockReset().mockResolvedValue({
      code: 0,
      stdout: JSON.stringify({
        success: true,
        data: {
          component: 'sing_box',
          action,
          current: {
            version: '1.14.3',
            variant: 'extended-compressed',
            source,
            admission: 'admitted',
            sha256: 'a'.repeat(64),
            capabilities: {
              reality_hybrid: true,
              reality_record_fragment: true,
            },
          },
          target: {
            variant,
            source: 'official',
            admission: 'unverified',
            capabilities: null,
          },
          requirements: {
            basis: 'generated_config',
            record_fragment: 1,
            reality: 1,
          },
          restart_expected: true,
          recovery: 'sing_box_transaction',
          connectivity_tested: false,
        },
      }),
    });
    // Use the same live store singleton as the dynamically loaded controller.
    const { store: liveStore } = await import(
      '../../../services/store.service'
    );
    liveStore.set({
      tabService: { ...liveStore.get().tabService, current: 'updates' },
      diagnosticsSystemInfo: {
        ...liveStore.get().diagnosticsSystemInfo,
        loaded: true,
        loading: false,
        sing_box_version: '1.14.3',
        sing_box_extended: 1,
        sing_box_compressed: 1,
      },
    });
    document.body.append(
      nativeElement('div', { id: 'updates-status' }),
      nativeElement('div', { id: 'fkp_updates-components' }),
    );
    const { initController } = await import('../initController');
    await initController();
    await tick();
    liveStore.set({
      updatesChecks: {
        ...liveStore.get().updatesChecks,
        sing_box: {
          status: 'outdated',
          latest_version: cachedVersion,
          release_url: 'https://github.com/example/releases',
        },
      },
    });
    await tick();
    expect(
      document.getElementById('fkp_updates-components')!.textContent,
    ).toContain(cachedVersion);
    click(selected);
    await tick();
    const preview = document.body.lastElementChild!;
    expect(boundary.start).not.toHaveBeenCalled();
    expect(preview.textContent).toContain(source);
    expect(preview.textContent).toContain('Цель: неизвестно');
    expect(preview.textContent).not.toContain(cachedVersion);
    expect(document.body.textContent).toContain(
      'Возможности целевой сборки не подтверждены',
    );
    expect(document.body.textContent).toContain('SHA256');
    expect(document.body.textContent).toContain('REALITY');
    click('Установить после просмотра');
    await tick();
    expect(boundary.start).toHaveBeenCalledWith('sing_box', action);
    expect(document.body.textContent).toContain('Применённая версия: 1.15.0');
    expect(document.body.textContent).toContain(
      'Состояние службы: не подтверждено',
    );
    expect(document.body.textContent).toContain(
      'Сетевой результат: не проверялся',
    );
  },
);
