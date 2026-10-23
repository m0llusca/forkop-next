import { executeShellCommand } from '../../helpers/executeShellCommand';
export type NextResponse = { success: boolean; error?: string; data?: unknown };
export async function nextRequest(
  action: string,
  payload: object = {},
): Promise<NextResponse> {
  const response = await executeShellCommand({
    command: '/usr/bin/forkop',
    args:
      action === 'route_explain'
        ? ['route_explain', JSON.stringify(payload)]
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
    if (
      value.success &&
      typeof window !== 'undefined' &&
      [
        'profile_apply',
        'rollback',
        'device_set',
        'gaming_apply',
        'temporary_add',
        'temporary_delete',
        'recommendation_accept',
        'smart_detect_configure',
      ].includes(action)
    )
      window.dispatchEvent(new CustomEvent('forkop:configuration-changed'));
    return value;
  } catch {
    return { success: false, error: response.stderr || 'invalid_response' };
  }
}
