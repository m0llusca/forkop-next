import { it, expect, vi } from 'vitest';
import { registerConfigurationReload } from '../configReload';
it('preserves the page and delegates a successful configuration change to native synchronization', async () => {
  vi.useFakeTimers();
  const events = new EventTarget();
  let reloads = 0;
  const target = {
    addEventListener: events.addEventListener.bind(events),
    location: { reload: () => reloads++ },
    setTimeout,
  };
  registerConfigurationReload(target);
  registerConfigurationReload(target);
  expect(reloads).toBe(0);
  events.dispatchEvent(new CustomEvent('forkop:configuration-changed'));
  expect(reloads).toBe(0);
  await vi.advanceTimersByTimeAsync(200);
  expect(reloads).toBe(0);
  vi.useRealTimers();
});
it('waits for native preflight and blocks concurrent mutations without releasing the first lock', async () => {
  // Tested through the real command boundary: a second action must never reach exec.
  const { nextRequest } = await import('../api');
  const finishes: Array<
    (value: { code: number; stdout: string; stderr: string }) => void
  > = [];
  let settled = 0,
    executions = 0;
  const events = new EventTarget();
  vi.stubGlobal('window', events);
  registerConfigurationReload(events, {
    beforeChange: async () => {},
    changed: async () => {},
    settled: () => settled++,
  });
  vi.stubGlobal('fs', {
    exec: async () => {
      executions++;
      return new Promise((resolve) => {
        finishes.push(resolve);
      });
    },
  });
  const first = nextRequest('recover');
  for (let i = 0; i < 20; i++) await Promise.resolve();
  const second = nextRequest('device_set', {
    address: '192.0.2.1',
    section: 'main',
  });
  for (let i = 0; i < 20; i++) await Promise.resolve();
  const settledBeforeCompletion = settled;
  finishes.forEach((finish) =>
    finish({ code: 0, stdout: '{"success":true}', stderr: '' }),
  );
  const responses = await Promise.all([first, second]);
  expect(responses[1]).toEqual({
    success: false,
    error: 'native_mutation_busy',
  });
  expect(executions).toBe(1);
  expect(settledBeforeCompletion).toBe(0);
  expect(settled).toBe(1);
  vi.unstubAllGlobals();
});
