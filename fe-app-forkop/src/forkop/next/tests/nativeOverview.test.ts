// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { renderNextPanel, type OverviewAdapters } from '../render';
afterEach(() => {
  document.body.replaceChildren();
});
function nativeAdapters(
  shell: Record<string, unknown>,
  runtime: Record<string, unknown> = {},
) {
  let adapters!: OverviewAdapters;
  const field = { cfgvalue: () => undefined };
  const main = {
    ForkopShellMethods: shell,
    ...runtime,
    renderNextPanel: (_r: unknown, _l: unknown, a: OverviewAdapters) => {
      adapters = a;
    },
  };
  const source = readFileSync(
    '../luci-app-forkop/htdocs/luci-static/resources/view/forkop/next.js',
    'utf8',
  );
  const controller = new Function('baseclass', 'form', 'main', source)(
    { extend: (v: unknown) => v },
    { DummyValue: 'dummy' },
    main,
  );
  controller.createNextContent({ option: () => field });
  field.cfgvalue();
  return adapters;
}
it('starts and follows the actual native job and preserves terminal service errors', async () => {
  const serviceActionStart = vi.fn(async () => ({
    success: true,
    data: { job_id: 'job1' },
  }));
  const waitServiceActionJob = vi.fn(async () => ({
    success: true,
    data: { success: false, message: 'actual backend failure' },
  }));
  const adapters = nativeAdapters({ serviceActionStart, waitServiceActionJob });
  expect(await adapters.changeService!('stop')).toEqual({
    success: false,
    error: 'actual backend failure',
  });
  expect(serviceActionStart).toHaveBeenCalledExactlyOnceWith('stop');
  expect(waitServiceActionJob).toHaveBeenCalledExactlyOnceWith('job1');
});
it.each(['undefined', 'rejected'])(
  'lets a fresh failed runtime read supersede a synchronous cached replay (%s)',
  async (failure) => {
    let finish!: () => void;
    const adapters = nativeAdapters(
      {},
      {
        refreshRuntimeUiState: () =>
          new Promise((resolve, reject) => {
            finish = () =>
              failure === 'undefined'
                ? resolve(undefined)
                : reject(Error('offline'));
          }),
        subscribeRuntimeUiState: (listener: (state: unknown) => void) => {
          listener({
            service: { forkop: { running: 1 } },
            actions: { service: [] },
          });
          return () => {};
        },
      },
    );
    const panel = renderNextPanel(undefined, undefined, adapters);
    document.body.append(panel);
    await new Promise((r) => setTimeout(r, 0));
    finish();
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(panel.querySelector('.fkp-next-service')?.textContent).toContain(
      'Состояние сервиса недоступно',
    );
    const control = [...panel.querySelectorAll('button')].find(
      (b) =>
        b.textContent === 'Включить сервис' ||
        b.textContent === 'Отключить сервис',
    )!;
    expect(control.disabled).toBe(true);
  },
);
it('preserves a genuine newer runtime update after the native cached replay', async () => {
  let finish!: () => void;
  let update!: (state: unknown) => void;
  const adapters = nativeAdapters(
    {},
    {
      refreshRuntimeUiState: () =>
        new Promise((resolve) => {
          finish = () => resolve(undefined);
        }),
      subscribeRuntimeUiState: (listener: (state: unknown) => void) => {
        update = listener;
        listener({ service: { forkop: { running: 1 } } });
        return () => {};
      },
    },
  );
  const panel = renderNextPanel(undefined, undefined, adapters);
  document.body.append(panel);
  await new Promise((r) => setTimeout(r, 0));
  update({ service: { forkop: { running: 0 } }, actions: { service: [] } });
  finish();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(panel.querySelector('.fkp-next-service')?.textContent).toBe(
    'Сервис остановлен',
  );
});
it('does not replay cached running state over an already completed fresh failure', async () => {
  const adapters = nativeAdapters(
    {},
    {
      refreshRuntimeUiState: async () => undefined,
      subscribeRuntimeUiState: (listener: (state: unknown) => void) => {
        listener({ service: { forkop: { running: 1 } } });
        return () => {};
      },
    },
  );
  const panel = renderNextPanel(undefined, undefined, adapters);
  document.body.append(panel);
  await new Promise((r) => setTimeout(r, 0));
  expect(panel.querySelector('.fkp-next-service')?.textContent).toContain(
    'Состояние сервиса недоступно',
  );
});
it('keeps a known fresh failure while a resumed native subscription replays its old cache', async () => {
  let reads = 0;
  const adapters = nativeAdapters(
    {},
    {
      refreshRuntimeUiState: () =>
        ++reads === 1 ? Promise.resolve(undefined) : new Promise(() => {}),
      subscribeRuntimeUiState: (listener: (state: unknown) => void) => {
        listener({ service: { forkop: { running: 1 } } });
        return () => {};
      },
    },
  );
  const pane = document.createElement('div');
  pane.dataset.tabActive = 'true';
  const panel = renderNextPanel(undefined, undefined, adapters);
  pane.append(panel);
  document.body.append(pane);
  await new Promise((r) => setTimeout(r, 0));
  pane.dataset.tabActive = 'false';
  await new Promise((r) => setTimeout(r, 0));
  pane.dataset.tabActive = 'true';
  await new Promise((r) => setTimeout(r, 0));
  expect(panel.querySelector('.fkp-next-service')?.textContent).toContain(
    'Состояние сервиса недоступно',
  );
});
it('does not wait for a rejected native job and exposes the actual start error', async () => {
  const waitServiceActionJob = vi.fn();
  const adapters = nativeAdapters({
    serviceActionStart: async () => ({
      success: false,
      error: 'permission denied',
    }),
    waitServiceActionJob,
  });
  expect(await adapters.changeService!('start')).toEqual({
    success: false,
    error: 'permission denied',
  });
  expect(waitServiceActionJob).not.toHaveBeenCalled();
});
it('maps real controller traffic counters and connection count without inventing samples', async () => {
  const adapters = nativeAdapters({
    getClashApiConnections: async () => ({
      success: true,
      data: { downloadTotal: 200, uploadTotal: 100, connections: [{}, {}] },
    }),
  });
  expect(await adapters.readTraffic!()).toEqual({
    downloadTotal: 200,
    uploadTotal: 100,
    connections: 2,
  });
  const failed = nativeAdapters({
    getClashApiConnections: async () => ({ success: false, error: 'offline' }),
  });
  await expect(failed.readTraffic!()).rejects.toThrow('offline');
});
