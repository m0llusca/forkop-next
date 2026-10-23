import { it, expect, vi } from 'vitest';
import { registerConfigurationReload } from '../configReload';
it('reloads native LuCI once after a successful configuration change, after feedback can render', async () => {
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
  expect(reloads).toBe(1);
  vi.useRealTimers();
});
