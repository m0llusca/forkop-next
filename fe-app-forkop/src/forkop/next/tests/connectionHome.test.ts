// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { renderNextPanel, type OverviewRuntime } from '../render';
import { createTrafficMonitor, type OverviewTraffic } from '../traffic';
import type { ConnectionLoader } from '../advanced';

const tick = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const settle = () => new Promise((r) => setTimeout(r, 0));
const button = (p: HTMLElement, text: string) =>
  [...p.querySelectorAll('button')].find((b) => b.textContent === text)!;
const metric = (p: HTMLElement, name: string) =>
  p.querySelector(`[data-metric="${name}"]`)?.textContent;
const group = (sectionName: string, name: string, selected = true) => ({
  sectionName,
  code: `${sectionName}-out`,
  displayName: sectionName,
  outbounds: [{ code: name, displayName: name, selected, latency: 0 }],
});
afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it.each([
  [1024, '1 КиБ'],
  [1048576, '1 МиБ'],
  [1099511627776, '1 ТиБ'],
  [1536, '1,5 КиБ'],
  [0, '0 Б'],
])('renders %s bytes as a readable semantic quantity', async (bytes, text) => {
  vi.useFakeTimers();
  const output = document.createElement('div');
  const monitor = createTrafficMonitor(
    output,
    async () => ({
      downloadTotal: bytes,
      uploadTotal: 0,
      connections: 0,
    }),
    () => true,
  );
  await monitor.refresh();
  expect(output.querySelector('dl')).not.toBeNull();
  expect(metric(output, 'download-total')).toBe(text);
  expect(metric(output, 'upload-total')).toBe('0 Б');
  expect(metric(output, 'connections')).toBe('0');
  expect(metric(output, 'download-rate')).toBe('—');
  monitor.stop();
});

it('updates structured rates and clears stale readings on failure and counter reset', async () => {
  vi.useFakeTimers();
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
  let sample = { downloadTotal: 1024, uploadTotal: 0, connections: 0 };
  let fail = false;
  const output = document.createElement('div');
  const monitor = createTrafficMonitor(
    output,
    async () => {
      if (fail) throw Error('offline');
      return sample;
    },
    () => true,
  );
  await monitor.refresh();
  clock.mockReturnValue(2000);
  sample = { downloadTotal: 2048, uploadTotal: 0, connections: 2 };
  await monitor.refresh();
  expect(metric(output, 'download-rate')).toBe('1 КиБ/с');
  expect(metric(output, 'upload-rate')).toBe('0 Б/с');
  clock.mockReturnValue(3000);
  sample = { downloadTotal: 0, uploadTotal: 0, connections: 0 };
  await monitor.refresh();
  expect(metric(output, 'download-total')).toBe('0 Б');
  expect(metric(output, 'download-rate')).toBe('—');
  fail = true;
  await monitor.refresh();
  expect(metric(output, 'download-total')).toBe('—');
  expect(metric(output, 'connections')).toBe('—');
  expect(output.textContent).toContain('Трафик пока недоступен');
  fail = false;
  clock.mockReturnValue(4000);
  await monitor.refresh();
  expect(metric(output, 'download-rate')).toBe('—');
  monitor.stop();
});

it.each([NaN, Infinity, -1, undefined, null])(
  'keeps malformed counter %s unknown instead of zero',
  async (invalid) => {
    vi.useFakeTimers();
    const output = document.createElement('div');
    const monitor = createTrafficMonitor(
      output,
      async () => ({
        downloadTotal: invalid as number,
        uploadTotal: 0,
        connections: 0,
      }),
      () => true,
    );
    await monitor.refresh();
    expect(metric(output, 'download-total')).toBe('—');
    monitor.stop();
  },
);

it('distinguishes native main from additional groups including unselected routes', async () => {
  const load: ConnectionLoader = async () => ({
    success: true,
    data: [
      group('games', 'Game route'),
      group('main', 'Primary server'),
      group('work', 'Work server', false),
    ],
  });
  const panel = renderNextPanel(undefined, load, { workspace: true });
  document.body.append(panel);
  await tick();
  expect(panel.querySelector('.fkp-next-primary')?.textContent).toContain(
    'Primary server',
  );
  expect(panel.querySelector('.fkp-next-primary')?.textContent).not.toContain(
    'Game route',
  );
  expect(panel.querySelector('.fkp-next-routes')?.textContent).toContain(
    'games: Game route',
  );
  expect(panel.querySelector('.fkp-next-routes')?.textContent).toContain(
    'work: сервер не выбран',
  );
  expect(panel.querySelector('header')).toBeNull();
});

it('omits duplicate workspace theme and advanced controls but retains standalone disclosure', () => {
  const workspace = renderNextPanel(undefined, undefined, { workspace: true });
  expect(workspace.querySelector('select')).toBeNull();
  expect(workspace.querySelector('details')).toBeNull();
  expect(renderNextPanel().querySelector('details>summary')).not.toBeNull();
});

it('names the captured probe target while pending and after the field changes', async () => {
  let finish!: (value: { success: true; data: { reachable: boolean } }) => void;
  const panel = renderNextPanel(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  document.body.append(panel);
  await settle();
  const field = panel.querySelector<HTMLInputElement>(
    '[name=connection_domain]',
  )!;
  expect(field.getAttribute('aria-label')).toBe('Сайт для проверки');
  field.value = 'example.org';
  button(panel, 'Проверить соединение').click();
  const status = panel.querySelector<HTMLElement>('.fkp-next-connection')!;
  expect(status.dataset.state).toBe('pending');
  expect(status.textContent).toContain('example.org');
  field.value = 'other.org';
  finish({ success: true, data: { reachable: true } });
  await tick();
  expect(status.dataset.state).toBe('reachable');
  expect(status.textContent).toContain('example.org');
  expect(status.textContent).not.toContain('other.org');
});

it('invalidates old probe results when a selected outbound changes', async () => {
  let name = 'Before';
  const panel = renderNextPanel(
    async () => ({ success: true, data: { reachable: true } }),
    async () => ({ success: true, data: [group('main', name)] }),
  );
  document.body.append(panel);
  await settle();
  panel.querySelector<HTMLInputElement>('input')!.value = 'example.org';
  button(panel, 'Проверить соединение').click();
  await tick();
  expect(
    panel.querySelector<HTMLElement>('.fkp-next-connection')!.dataset.state,
  ).toBe('reachable');
  name = 'After';
  button(panel, 'Обновить данные').click();
  await tick();
  expect(
    panel.querySelector<HTMLElement>('.fkp-next-connection')!.dataset.state,
  ).toBe('unknown');
  expect(panel.querySelector('.fkp-next-connection')!.textContent).toContain(
    'Повторите проверку',
  );
});

it.each(['navigation', 'runtime', 'route', 'configuration'])(
  'rejects an obsolete pending probe after %s changes',
  async (change) => {
    let finish!: (value: {
      success: true;
      data: { reachable: boolean };
    }) => void;
    let update!: (state: OverviewRuntime) => void;
    let name = 'Before';
    const panel = renderNextPanel(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      async () => ({ success: true, data: [group('main', name)] }),
      {
        readRuntime: async () => ({ running: true }),
        subscribeRuntime: (listener) => {
          update = listener;
          return () => {};
        },
      },
    );
    document.body.append(panel);
    await settle();
    panel.querySelector<HTMLInputElement>('input')!.value = 'example.org';
    button(panel, 'Проверить соединение').click();
    if (change === 'navigation') {
      panel.hidden = true;
      await settle();
    }
    if (change === 'runtime') update({ running: true, pending: true });
    if (change === 'configuration')
      window.dispatchEvent(new CustomEvent('forkop:configuration-changed'));
    if (change === 'route') {
      name = 'After';
      button(panel, 'Обновить данные').click();
      await tick();
    }
    finish({ success: true, data: { reachable: true } });
    await tick();
    expect(
      panel.querySelector<HTMLElement>('.fkp-next-connection')!.dataset.state,
    ).toBe('unknown');
    expect(
      panel.querySelector('.fkp-next-connection')!.textContent,
    ).not.toContain('Есть сетевой ответ');
  },
);

it.each(['configuration', 'suspension'])(
  'clears every metric after %s while replacement telemetry is unresolved',
  async (reset) => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    let sample = { downloadTotal: 1024, uploadTotal: 0, connections: 1 };
    let defer = false;
    let finish!: (value: OverviewTraffic) => void;
    const panel = renderNextPanel(undefined, undefined, {
      readTraffic: () =>
        defer
          ? new Promise<OverviewTraffic>((resolve) => {
              finish = resolve;
            })
          : Promise.resolve(sample),
    });
    document.body.append(panel);
    await settle();
    clock.mockReturnValue(2000);
    sample = { downloadTotal: 2048, uploadTotal: 1024, connections: 3 };
    button(panel, 'Обновить данные').click();
    await tick();
    expect(metric(panel, 'download-rate')).toBe('1 КиБ/с');
    expect(metric(panel, 'connections')).toBe('3');
    defer = true;
    if (reset === 'configuration')
      window.dispatchEvent(new CustomEvent('forkop:configuration-changed'));
    else {
      panel.hidden = true;
      await settle();
      panel.hidden = false;
      await settle();
    }
    expect(
      [...panel.querySelectorAll('[data-metric]')].map(
        (node) => node.textContent,
      ),
    ).toEqual(['—', '—', '—', '—', '—']);
    expect(panel.querySelector('.fkp-next-traffic-status')?.textContent).toBe(
      'Обновляем трафик…',
    );
    clock.mockReturnValue(5000);
    finish({ downloadTotal: 4096, uploadTotal: 2048, connections: 2 });
    await tick();
    expect(metric(panel, 'download-total')).toBe('4 КиБ');
    expect(metric(panel, 'connections')).toBe('2');
    expect(metric(panel, 'download-rate')).toBe('—');
    expect(metric(panel, 'upload-rate')).toBe('—');
    defer = false;
    clock.mockReturnValue(6000);
    sample = { downloadTotal: 5120, uploadTotal: 3072, connections: 1 };
    button(panel, 'Обновить данные').click();
    await tick();
    expect(metric(panel, 'download-rate')).toBe('1 КиБ/с');
  },
);
