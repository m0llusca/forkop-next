import { ValidationResult } from './types';
import { isValidPort, parseHostPort } from './hostPort';

// TODO refactor current validation and add tests
export function validateShadowsocksUrl(url: string): ValidationResult {
  if (!url.startsWith('ss://')) {
    return {
      valid: false,
      message: _('Invalid Shadowsocks URL: must start with ss://'),
    };
  }

  try {
    if (!url || /\s/.test(url)) {
      return {
        valid: false,
        message: _('Invalid Shadowsocks URL: must not contain spaces'),
      };
    }

    const withoutFragment = url.split('#')[0];
    const [mainPart, queryPart] = withoutFragment.split('?');
    const body = mainPart.slice('ss://'.length);
    const atIndex = body.lastIndexOf('@');

    if (atIndex <= 0) {
      return {
        valid: false,
        message: _('Invalid Shadowsocks URL: missing credentials'),
      };
    }

    const encryptedPart = body.slice(0, atIndex);
    const serverPart = body.slice(atIndex + 1).split('/')[0];

    let decodedCredentials = '';
    try {
      decodedCredentials = decodeURIComponent(encryptedPart);
    } catch {
      decodedCredentials = encryptedPart;
    }

    if (!decodedCredentials.includes(':')) {
      if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(encryptedPart)) {
        return {
          valid: false,
          message: _(
            'Invalid Shadowsocks URL: missing method and password separator ":"',
          ),
        };
      }
      try {
        const normalized = encryptedPart.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(
          normalized.length + ((4 - (normalized.length % 4)) % 4),
          '=',
        );
        const decoded = atob(padded);
        if (!decoded.includes(':')) {
          return {
            valid: false,
            message: _(
              'Invalid Shadowsocks URL: decoded credentials must contain method:password',
            ),
          };
        }
      } catch (_e) {
        return {
          valid: false,
          message: _(
            'Invalid Shadowsocks URL: missing method and password separator ":"',
          ),
        };
      }
    }

    if (!serverPart) {
      return {
        valid: false,
        message: _('Invalid Shadowsocks URL: missing server address'),
      };
    }

    const parsedHostPort = parseHostPort(serverPart);
    if (!parsedHostPort) {
      return {
        valid: false,
        message: _('Invalid Shadowsocks URL: invalid server and port'),
      };
    }
    const { host: server, port } = parsedHostPort;

    if (!server) {
      return {
        valid: false,
        message: _('Invalid Shadowsocks URL: missing server'),
      };
    }

    if (!port) {
      return {
        valid: false,
        message: _('Invalid Shadowsocks URL: missing port'),
      };
    }

    if (!isValidPort(port)) {
      return {
        valid: false,
        message: _('Invalid port number. Must be between 1 and 65535'),
      };
    }

    void queryPart;
  } catch (_e) {
    return {
      valid: false,
      message: _('Invalid Shadowsocks URL: parsing failed'),
    };
  }

  return { valid: true, message: _('Valid') };
}
