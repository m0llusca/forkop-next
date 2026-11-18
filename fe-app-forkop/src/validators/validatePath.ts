import { ValidationResult } from './types';

export function validatePath(value: string): ValidationResult {
  if (!value) {
    return {
      valid: false,
      message: _('Path cannot be empty'),
    };
  }

  const pathRegex = /^\/[a-zA-Z0-9_\-/.]+$/;
  const segments = value.split('/').slice(1);
  const hasInvalidSegments =
    value.includes('//') ||
    segments.some((part) => part === '.' || part === '..');

  if (pathRegex.test(value) && !hasInvalidSegments) {
    return {
      valid: true,
      message: _('Valid'),
    };
  }

  return {
    valid: false,
    message: _(
      'Invalid path format. Path must start with "/" and contain valid characters',
    ),
  };
}
