// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { createTrafficMonitor, type OverviewTraffic } from '../traffic';
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('automatically reads again after three seconds and cancels its next read when stopped', async () => {
  vi.useFakeTimers();
  let visible = true;
  const read = vi.fn(async () => ({
    downloadTotal: 10,
    uploadTotal: 20,
    connections: 0,
  }));
  const monitor = createTrafficMonitor(
    document.createElement('p'),
    read,
    () => visible,
  );
  await monitor.refresh();
  await vi.advanceTimersByTimeAsync(2999);
  expect(read).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);
  expect(read).toHaveBeenCalledTimes(2);
  visible = false;
  monitor.stop();
  await vi.advanceTimersByTimeAsync(9000);
  expect(read).toHaveBeenCalledTimes(2);
});
it('keeps rates unknown for zero or backwards monotonic time and rejects malformed counters', async () => {
  vi.useFakeTimers();
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
  let sample = { downloadTotal: 10, uploadTotal: 20, connections: 0 };
  const output = document.createElement('p');
  const monitor = createTrafficMonitor(
    output,
    async () => sample,
    () => true,
  );
  await monitor.refresh();
  sample = { downloadTotal: 20, uploadTotal: 40, connections: 1 };
  await monitor.refresh();
  expect(output.textContent).toContain('Скорость ещё не измерена');
  clock.mockReturnValue(900);
  await monitor.refresh();
  expect(output.textContent).toContain('Скорость ещё не измерена');
  sample = { downloadTotal: NaN, uploadTotal: -1, connections: 0 };
  await monitor.refresh();
  expect(output.textContent).toContain('Трафик пока недоступен');
  monitor.stop();
});
it('resets the rate baseline after a failed sample', async () => {
  vi.useFakeTimers();
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
  let fail = false;
  const output = document.createElement('p');
  const monitor = createTrafficMonitor(
    output,
    async () => {
      if (fail) throw Error('offline');
      return { downloadTotal: 10, uploadTotal: 20, connections: 0 };
    },
    () => true,
  );
  await monitor.refresh();
  fail = true;
  await monitor.refresh();
  expect(output.textContent).toContain('Трафик пока недоступен');
  fail = false;
  clock.mockReturnValue(5000);
  await monitor.refresh();
  expect(output.textContent).toContain('Скорость ещё не измерена');
  monitor.stop();
});

it('clears stopped readings, rejects an obsolete sample and needs two fresh samples for rates', async () => {
  vi.useFakeTimers();
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
  let sample = { downloadTotal: 1024, uploadTotal: 0, connections: 1 };
  let defer = false;
  let finish!: (value: OverviewTraffic) => void;
  const output = document.createElement('div');
  const monitor = createTrafficMonitor(
    output,
    () =>
      defer
        ? new Promise<OverviewTraffic>((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(sample),
    () => true,
  );
  const value = (name: string) =>
    output.querySelector(`[data-metric="${name}"]`)?.textContent;
  const expectUnknown = () =>
    expect(
      [...output.querySelectorAll('[data-metric]')].map(
        (node) => node.textContent,
      ),
    ).toEqual(['—', '—', '—', '—', '—']);
  await monitor.refresh();
  clock.mockReturnValue(2000);
  sample = { downloadTotal: 2048, uploadTotal: 1024, connections: 3 };
  await monitor.refresh();
  expect(value('download-rate')).toBe('1 КиБ/с');
  expect(value('connections')).toBe('3');
  defer = true;
  const obsolete = monitor.refresh();
  monitor.stop();
  expectUnknown();
  finish({ downloadTotal: 3072, uploadTotal: 2048, connections: 4 });
  await obsolete;
  expectUnknown();
  const replacement = monitor.refresh();
  expectUnknown();
  expect(output.querySelector('[role=status]')?.textContent).toBe(
    'Обновляем трафик…',
  );
  clock.mockReturnValue(5000);
  finish({ downloadTotal: 4096, uploadTotal: 2048, connections: 2 });
  await replacement;
  expect(value('download-total')).toBe('4 КиБ');
  expect(value('connections')).toBe('2');
  expect(value('download-rate')).toBe('—');
  expect(value('upload-rate')).toBe('—');
  defer = false;
  clock.mockReturnValue(6000);
  sample = { downloadTotal: 5120, uploadTotal: 3072, connections: 1 };
  await monitor.refresh();
  expect(value('download-rate')).toBe('1 КиБ/с');
  expect(value('upload-rate')).toBe('1 КиБ/с');
  monitor.stop();
});
