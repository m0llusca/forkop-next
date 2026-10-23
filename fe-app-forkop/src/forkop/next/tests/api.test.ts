import { describe, expect, it, vi, afterEach } from 'vitest';
import { nextRequest } from '../api';
afterEach(() => vi.unstubAllGlobals());
describe('Next CLI boundary', () => {
  it('passes untrusted content as one JSON argument without shell interpretation', async () => {
    let captured: string[] = [];
    vi.stubGlobal('fs', {
      exec: async (_command: string, args: string[]) => {
        captured = args;
        return {
          code: 0,
          stdout: '{"success":true,"data":{"name":"saved"}}',
          stderr: '',
        };
      },
    });
    const result = await nextRequest('profile_import', {
      name: 'saved',
      config: '$(touch /tmp/pwned)\nconfig forkop',
    });
    expect(captured).toEqual([
      'next',
      'profile_import',
      '{"name":"saved","config":"$(touch /tmp/pwned)\\nconfig forkop"}',
    ]);
    expect(result).toEqual({ success: true, data: { name: 'saved' } });
  });
  it('rejects malformed and nonzero responses without reporting success', async () => {
    vi.stubGlobal('fs', {
      exec: async () => ({ code: 0, stdout: 'not JSON', stderr: '' }),
    });
    expect(await nextRequest('status')).toEqual({
      success: false,
      error: 'invalid_response',
    });
    vi.stubGlobal('fs', {
      exec: async () => ({
        code: 1,
        stdout: '{"success":true}',
        stderr: 'failed',
      }),
    });
    expect((await nextRequest('status')).success).toBe(false);
  });
});

it('uses top-level route_explain while all mutation actions use next', async () => {
  const calls: string[][] = [];
  vi.stubGlobal('fs', {
    exec: async (_: string, args: string[]) => {
      calls.push(args);
      return { code: 0, stdout: '{"success":true,"data":{}}', stderr: '' };
    },
  });
  await nextRequest('route_explain', { domain: 'example.org' });
  expect(calls).toEqual([['route_explain', '{"domain":"example.org"}']]);
});

it('does not put imported proxy credentials into operation timing logs', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.stubGlobal('fs', {
    exec: async () => ({ code: 0, stdout: '{"success":true}', stderr: '' }),
  });
  await nextRequest('profile_import', {
    name: 'home',
    config: 'password secret-fixture-123',
  });
  expect(log.mock.calls.flat().join(' ')).not.toContain('secret-fixture-123');
  log.mockRestore();
});

it('notifies native LuCI after active configuration changes but not profile imports or reads', async () => {
  const target = new EventTarget();
  let changed = 0;
  target.addEventListener('forkop:configuration-changed', () => changed++);
  vi.stubGlobal('window', target);
  vi.stubGlobal('fs', {
    exec: async () => ({
      code: 0,
      stdout: '{"success":true,"data":{}}',
      stderr: '',
    }),
  });
  await nextRequest('status');
  await nextRequest('profile_import', {
    name: 'saved',
    config: 'config forkop',
  });
  expect(changed).toBe(0);
  await nextRequest('device_set', { address: '192.0.2.1', section: 'main' });
  expect(changed).toBe(1);
  await nextRequest('smart_detect_configure', {
    enabled: true,
    section: 'main',
  });
  expect(changed).toBe(2);
  vi.stubGlobal('fs', {
    exec: async () => ({
      code: 1,
      stdout: '{"success":false,"error":"failed"}',
      stderr: '',
    }),
  });
  await nextRequest('profile_apply', { name: 'saved' });
  expect(changed).toBe(2);
});
