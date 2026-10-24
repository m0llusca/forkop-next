// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
const boundary = vi.hoisted(() => ({ logs: vi.fn() }));
vi.mock('../../../../helpers', async () => ({
  ...(await vi.importActual('../../../../helpers')),
  onMount: () => new Promise(() => {}),
}));
vi.mock('../../../../helpers/executeShellCommand', () => ({
  executeShellCommand: boundary.logs,
}));
it('opens the existing logs action from route tools before the native diagnostic pane becomes visible', async () => {
  boundary.logs.mockResolvedValue({
    code: 1,
    stdout: '',
    stderr: 'synthetic unavailable log',
  });
  const { logger } = await import('../../../services');
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  const { initController } = await import('../initController');
  await initController();
  document.dispatchEvent(new CustomEvent('forkop:diagnostic-logs'));
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(boundary.logs).toHaveBeenCalledOnce();
  expect(boundary.logs).toHaveBeenCalledWith(
    expect.objectContaining({
      command: '/usr/bin/forkop',
      args: ['check_logs'],
    }),
  );
  vi.restoreAllMocks();
});
