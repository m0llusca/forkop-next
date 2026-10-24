import { ForkopShellMethods } from '../../methods';
import { nextRequest, type NextResponse } from '../../next/api';
import { executeShellCommand } from '../../../helpers/executeShellCommand';
export async function diagnosticRead(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<NextResponse> {
  if (action === 'diagnostic_dns')
    return ForkopShellMethods.checkDNSAvailable();
  if (action === 'diagnostic_service') return ForkopShellMethods.checkSingBox();
  if (action !== 'source_evidence') return nextRequest(action, payload);
  const response = await executeShellCommand({
    command: '/usr/bin/forkop',
    args: ['source_evidence', String(payload.section || '')],
    timeout: 15000,
  });
  try {
    const value = JSON.parse(response.stdout);
    return (response.code ?? 0) === 0 && typeof value.success === 'boolean'
      ? value
      : { success: false, error: 'invalid_response' };
  } catch {
    return { success: false, error: 'invalid_response' };
  }
}
