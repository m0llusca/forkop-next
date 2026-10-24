// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { createTrafficMonitor } from '../traffic';
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
