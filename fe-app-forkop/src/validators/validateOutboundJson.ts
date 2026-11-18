import { ValidationResult } from './types';
import { isValidHost } from './hostPort';
import {
  isValidCurve25519Key,
  validateAmneziaWgConfig,
  validateCidrOrIpList,
} from './validateWireGuardUrl';

const SERVER_OUTBOUND_TYPES = new Set([
  'vless',
  'vmess',
  'trojan',
  'shadowsocks',
  'socks',
  'http',
  'hysteria2',
  'hysteria',
]);

function invalid(message: string): ValidationResult {
  return { valid: false, message };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateServerPort(value: unknown): boolean {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 65535
  );
}

function validatePortString(value: string): number | null {
  if (!/^[0-9]+$/.test(value)) {
    return null;
  }
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

function validateHysteria2ServerPorts(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  return value.every((entry) => {
    if (typeof entry !== 'string') {
      return false;
    }
    const parts = entry.trim().split(':');
    if (parts.length !== 2) {
      return false;
    }
    const start = validatePortString(parts[0]);
    const end = validatePortString(parts[1]);
    return start !== null && end !== null && start <= end;
  });
}

function validateOutbounds(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => nonEmptyString(item))
  );
}

export function validateOutboundJson(
  value: string,
  usedTags: string[] = [],
): ValidationResult {
  const normalized = `${value || ''}`.trim();

  if (!normalized.length) {
    return invalid(_('JSON outbound cannot be empty'));
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(normalized);
  } catch {
    return { valid: false, message: _('Invalid JSON format') };
  }

  if (!isPlainObject(parsed)) {
    return invalid(_('JSON outbound must be a JSON object'));
  }

  if (!nonEmptyString(parsed.type)) {
    return invalid(_('JSON outbound must contain a non-empty type field'));
  }

  if (!nonEmptyString(parsed.tag)) {
    return invalid(_('JSON outbound must contain a non-empty tag field'));
  }

  const tag = parsed.tag.trim();
  if (usedTags.some((usedTag) => `${usedTag || ''}`.trim() === tag)) {
    return invalid(_('Duplicate JSON outbound tag'));
  }

  const type = parsed.type.trim().toLowerCase();

  if (type === 'wireguard') {
    if (
      !nonEmptyString(parsed.private_key) ||
      !isValidCurve25519Key(parsed.private_key)
    ) {
      return invalid(
        _('WireGuard outbound requires a valid Curve25519 private_key'),
      );
    }

    const rawAddr = parsed.address ?? parsed.local_address;
    const addrList =
      typeof rawAddr === 'string'
        ? [rawAddr]
        : Array.isArray(rawAddr) &&
            rawAddr.every((item) => nonEmptyString(item))
          ? (rawAddr as string[])
          : [];
    if (!addrList.length) {
      return invalid(
        _('WireGuard outbound requires a non-empty address string or array'),
      );
    }
    const addrCheck = validateCidrOrIpList(addrList);
    if (!addrCheck.valid) {
      return addrCheck;
    }

    if (!Array.isArray(parsed.peers) || parsed.peers.length === 0) {
      return invalid(_('WireGuard outbound requires a non-empty peers array'));
    }

    for (const peer of parsed.peers) {
      if (!isPlainObject(peer)) {
        return invalid(_('Each WireGuard peer must be a JSON object'));
      }
      if (!nonEmptyString(peer.address) || !isValidHost(peer.address.trim())) {
        return invalid(_('Each WireGuard peer requires a valid address'));
      }
      if (!validateServerPort(peer.port)) {
        return invalid(
          _('Each WireGuard peer requires a numeric port from 1 to 65535'),
        );
      }
      if (
        !nonEmptyString(peer.public_key) ||
        !isValidCurve25519Key(peer.public_key)
      ) {
        return invalid(
          _('Each WireGuard peer requires a valid Curve25519 public_key'),
        );
      }
      if (
        peer.pre_shared_key !== undefined &&
        (!nonEmptyString(peer.pre_shared_key) ||
          !isValidCurve25519Key(peer.pre_shared_key))
      ) {
        return invalid(
          _('WireGuard peer pre_shared_key must be a valid Curve25519 key'),
        );
      }
      if (peer.allowed_ips !== undefined) {
        if (
          !Array.isArray(peer.allowed_ips) ||
          peer.allowed_ips.length === 0 ||
          !peer.allowed_ips.every((ip) => nonEmptyString(ip))
        ) {
          return invalid(
            _('WireGuard peer allowed_ips must be a non-empty array of CIDRs'),
          );
        }
        const allowedCheck = validateCidrOrIpList(peer.allowed_ips as string[]);
        if (!allowedCheck.valid) {
          return allowedCheck;
        }
      }
    }

    if (parsed.mtu !== undefined) {
      if (
        typeof parsed.mtu !== 'number' ||
        !Number.isInteger(parsed.mtu) ||
        parsed.mtu < 576 ||
        parsed.mtu > 65535
      ) {
        return invalid(_('WireGuard MTU must be between 576 and 65535'));
      }
    }

    if (parsed.amnezia !== undefined) {
      if (!isPlainObject(parsed.amnezia)) {
        return invalid(_('WireGuard amnezia field must be a JSON object'));
      }
      const awgCheck = validateAmneziaWgConfig(parsed.amnezia, false);
      if (!awgCheck.valid) {
        return awgCheck;
      }
    }
  }

  if (type === 'warp') {
    if (parsed.mtu !== undefined) {
      return invalid(_('WARP outbound does not accept manual mtu override'));
    }

    const forbiddenTopKeys = ['s1', 's2', 's3', 's4', 'h1', 'h2', 'h3', 'h4'];
    if (forbiddenTopKeys.some((k) => parsed[k] !== undefined)) {
      return invalid(
        _(
          'Cloudflare WARP supports only 1-sided AmneziaWG parameters (jc, jmin, jmax, i1-i5)',
        ),
      );
    }

    if (parsed.profile !== undefined) {
      if (!isPlainObject(parsed.profile)) {
        return invalid(_('WARP profile field must be a JSON object'));
      }
      if (
        parsed.profile.private_key !== undefined &&
        (!nonEmptyString(parsed.profile.private_key) ||
          !isValidCurve25519Key(parsed.profile.private_key))
      ) {
        return invalid(
          _('WARP profile private_key must be a valid Curve25519 key'),
        );
      }
    }

    if (parsed.amnezia !== undefined) {
      if (!isPlainObject(parsed.amnezia)) {
        return invalid(_('WARP amnezia field must be a JSON object'));
      }
      const awgCheck = validateAmneziaWgConfig(parsed.amnezia, true);
      if (!awgCheck.valid) {
        return awgCheck;
      }
    }
  }

  if (
    (type === 'selector' || type === 'urltest') &&
    !validateOutbounds(parsed.outbounds)
  ) {
    return invalid(
      _(
        'Selector and URLTest outbounds must contain a non-empty outbounds array',
      ),
    );
  }

  if (SERVER_OUTBOUND_TYPES.has(type)) {
    if (!nonEmptyString(parsed.server)) {
      return invalid(
        _('Server outbound must contain a non-empty server field'),
      );
    }

    if (type === 'hysteria2' && parsed.server_ports !== undefined) {
      if (!validateHysteria2ServerPorts(parsed.server_ports)) {
        return invalid(_('server_port must be a number from 1 to 65535'));
      }
      if (
        parsed.server_port !== undefined &&
        !validateServerPort(parsed.server_port)
      ) {
        return invalid(
          _(
            'Server outbound must contain a numeric server_port from 1 to 65535',
          ),
        );
      }
    } else if (!validateServerPort(parsed.server_port)) {
      return invalid(
        _('Server outbound must contain a numeric server_port from 1 to 65535'),
      );
    }
  } else if (
    parsed.server_port !== undefined &&
    !validateServerPort(parsed.server_port)
  ) {
    return invalid(_('server_port must be a number from 1 to 65535'));
  }

  if (parsed.outbounds !== undefined && !validateOutbounds(parsed.outbounds)) {
    return invalid(_('outbounds must be a non-empty array of strings'));
  }

  if (parsed.detour !== undefined && !nonEmptyString(parsed.detour)) {
    return invalid(_('detour must be a non-empty string'));
  }

  return { valid: true, message: _('Valid') };
}
