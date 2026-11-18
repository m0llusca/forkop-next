import { executeShellCommand } from '../../helpers/executeShellCommand';
export type NextResponse = { success: boolean; error?: string; data?: unknown };
const configurationActions = new Set([
  'profile_apply',
  'rollback',
  'recover',
  'device_set',
  'gaming_apply',
  'temporary_add',
  'temporary_delete',
  'recommendation_accept',
  'smart_detect_configure',
]);
let configurationBusy = false;
async function configurationEvent(name: string, action: string) {
  const pending: Promise<void>[] = [];
  const event = new CustomEvent(name, {
    cancelable: true,
    detail: { action, waitUntil: (work: Promise<void>) => pending.push(work) },
  });
  window.dispatchEvent(event);
  await Promise.all(pending);
  if (event.defaultPrevented) throw Error('native_pending_changes');
}
export interface TspuStageResult {
  stage: 'dns' | 'tcp' | 'tls' | 'byte_cap';
  status: 'ok' | 'failed' | 'warning' | 'skipped';
  verdict?: string;
  remote_ip?: string;
  exitcode?: number;
  bytes_read?: number;
  http_code?: number;
  verified_64kb?: boolean;
  small_response?: boolean;
  duration_ms?: number;
}

export interface TspuClassifyData {
  domain: string;
  section: string;
  checked_at: number;
  verdict:
    | 'ok'
    | 'uplink_down'
    | 'dns_blocked'
    | 'dns_spoofed'
    | 'tcp_blocked'
    | 'tls_hello_blocked'
    | 'tls_cert_intercepted'
    | 'clock_skew'
    | 'tspu_byte_cap_16kb'
    | 'slow_link'
    | 'http_restricted'
    | 'probe_error';
  severity: 'ok' | 'none' | 'blocked' | 'warning' | 'error';
  recommended_action: string;
  remote_ip: string;
  http_code: number;
  bytes_read: number;
  stages: TspuStageResult[];
  comparison: null | {
    section: string;
    verdict: string;
    bypass_verified: boolean;
  };
}

export interface GamingApplyPayload {
  preset: 'steam' | 'playstation' | 'xbox' | 'console';
  section: string;
  device?: string;
  console_mode?: boolean;
}

export async function nextRequest(
  action: string,
  payload: object = {},
): Promise<NextResponse> {
  const mutation =
    configurationActions.has(action) && typeof window !== 'undefined';
  if (mutation) {
    if (configurationBusy)
      return { success: false, error: 'native_mutation_busy' };
    configurationBusy = true;
    try {
      await configurationEvent('forkop:configuration-changing', action);
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent('forkop:configuration-settled', { detail: { action } }),
      );
      configurationBusy = false;
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'native_pending_changes',
      };
    }
  }
  try {
    const response = await executeShellCommand({
      command: '/usr/bin/forkop',
      args:
        action === 'route_explain' || action === 'tspu_classify'
          ? [action, JSON.stringify(payload)]
          : ['next', action, JSON.stringify(payload)],
      timeout: 60000,
      operationName: `Forkop Next ${action}`,
    });
    try {
      const value = JSON.parse(response.stdout);
      if (!value || typeof value.success !== 'boolean')
        return { success: false, error: 'invalid_response' };
      if ((response.code ?? 0) !== 0 && value.success)
        return { success: false, error: response.stderr || 'command_failed' };
      if (value.success && mutation)
        await configurationEvent('forkop:configuration-changed', action);
      return value;
    } catch {
      return { success: false, error: response.stderr || 'invalid_response' };
    }
  } finally {
    if (mutation) {
      configurationBusy = false;
      window.dispatchEvent(
        new CustomEvent('forkop:configuration-settled', { detail: { action } }),
      );
    }
  }
}

export async function tspuClassify(payload: {
  domain: string;
  section?: string;
  compare_section?: string;
}): Promise<NextResponse & { data?: TspuClassifyData }> {
  return (await nextRequest('tspu_classify', payload || {})) as NextResponse & {
    data?: TspuClassifyData;
  };
}

export async function gamingApply(
  payload: GamingApplyPayload,
): Promise<NextResponse> {
  return nextRequest('gaming_apply', payload);
}
