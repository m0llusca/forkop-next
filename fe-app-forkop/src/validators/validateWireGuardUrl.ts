import { ValidationResult } from './types';
import { isValidHost, isValidPort, parseHostPort } from './hostPort';
import { validateSubnet } from './validateSubnet';

const WG_SCHEME_RE = /^(wireguard|wg|awg|amneziawg|warp):\/\//i;
const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function invalid(message: string): ValidationResult {
  return { valid: false, message };
}

function safeDecodePercent(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function decodeBase64Bytes(raw: string): Uint8Array | null {
  const trimmed = `${raw || ''}`.trim().replace(/-/g, '+').replace(/_/g, '/');

  if (!trimmed.length || /[^A-Za-z0-9+/=]/.test(trimmed)) {
    return null;
  }

  const withoutPad = trimmed.replace(/=+$/, '');
  const padLen = trimmed.length - withoutPad.length;
  if (padLen > 2) {
    return null;
  }

  const padded =
    withoutPad.length % 4 === 0
      ? withoutPad
      : withoutPad + '='.repeat(4 - (withoutPad.length % 4));
  if (padded.length % 4 !== 0) {
    return null;
  }

  const bytes: number[] = [];
  for (let i = 0; i < padded.length; i += 4) {
    const c0 = BASE64_ALPHABET.indexOf(padded[i]);
    const c1 = BASE64_ALPHABET.indexOf(padded[i + 1]);
    const c2 =
      padded[i + 2] === '=' ? -1 : BASE64_ALPHABET.indexOf(padded[i + 2]);
    const c3 =
      padded[i + 3] === '=' ? -1 : BASE64_ALPHABET.indexOf(padded[i + 3]);

    if (
      c0 < 0 ||
      c1 < 0 ||
      (padded[i + 2] !== '=' && c2 < 0) ||
      (padded[i + 3] !== '=' && c3 < 0)
    ) {
      return null;
    }

    bytes.push((c0 << 2) | (c1 >> 4));
    if (c2 >= 0) {
      bytes.push(((c1 & 0x0f) << 4) | (c2 >> 2));
      if (c3 >= 0) {
        bytes.push(((c2 & 0x03) << 6) | c3);
      }
    } else if (c3 >= 0) {
      return null;
    }
  }

  return new Uint8Array(bytes);
}

export function isValidCurve25519Key(raw: string): boolean {
  const decoded = safeDecodePercent(`${raw || ''}`.trim());
  const bytes = decodeBase64Bytes(decoded);
  return bytes !== null && bytes.length === 32;
}

function parseNonNegInt(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 0 ? raw : null;
  }
  const str = `${raw ?? ''}`.trim();
  if (!/^\d+$/.test(str)) {
    return null;
  }
  const num = Number(str);
  return Number.isSafeInteger(num) && num >= 0 ? num : null;
}

function parseHeaderRange(raw: unknown): [number, number] | null {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 0 && raw <= 4294967295
      ? [raw, raw]
      : null;
  }
  const str = `${raw ?? ''}`.trim();
  if (!str.length) {
    return null;
  }
  const match = str.match(/^(\d+)(?:-(\d+))?$/);
  if (!match) {
    return null;
  }
  const min = Number(match[1]);
  const max = match[2] !== undefined ? Number(match[2]) : min;
  if (
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min < 0 ||
    max > 4294967295 ||
    min > max
  ) {
    return null;
  }
  return [min, max];
}

export function validateAmneziaWgConfig(
  amnezia: Record<string, unknown>,
  oneSidedOnly = false,
): ValidationResult {
  const allowedKeys = new Set([
    'jc',
    'jmin',
    'jmax',
    's1',
    's2',
    's3',
    's4',
    'h1',
    'h2',
    'h3',
    'h4',
    'i1',
    'i2',
    'i3',
    'i4',
    'i5',
  ]);

  for (const key of Object.keys(amnezia)) {
    if (!allowedKeys.has(key)) {
      return invalid(_('Unknown AmneziaWG parameter'));
    }
  }

  const twoSidedKeys = ['s1', 's2', 's3', 's4', 'h1', 'h2', 'h3', 'h4'];
  if (
    oneSidedOnly &&
    twoSidedKeys.some(
      (k) => amnezia[k] !== undefined && `${amnezia[k]}`.trim() !== '',
    )
  ) {
    return invalid(
      _(
        'Cloudflare WARP supports only 1-sided AmneziaWG parameters (jc, jmin, jmax, i1-i5)',
      ),
    );
  }

  let jcVal: number | null = null;
  if (amnezia.jc !== undefined && `${amnezia.jc}`.trim() !== '') {
    jcVal = parseNonNegInt(amnezia.jc);
    if (jcVal === null || jcVal < 1 || jcVal > 128) {
      return invalid(_('AmneziaWG jc must be an integer between 1 and 128'));
    }
  }

  let jminVal: number | null = null;
  if (amnezia.jmin !== undefined && `${amnezia.jmin}`.trim() !== '') {
    jminVal = parseNonNegInt(amnezia.jmin);
    if (jminVal === null || jminVal > 1280) {
      return invalid(_('AmneziaWG jmin must be an integer between 0 and 1280'));
    }
  }

  let jmaxVal: number | null = null;
  if (amnezia.jmax !== undefined && `${amnezia.jmax}`.trim() !== '') {
    jmaxVal = parseNonNegInt(amnezia.jmax);
    if (jmaxVal === null || jmaxVal > 1280) {
      return invalid(_('AmneziaWG jmax must be an integer between 0 and 1280'));
    }
  }

  if ((jminVal !== null || jmaxVal !== null) && jcVal === null) {
    return invalid(_('AmneziaWG jc is required when jmin or jmax is set'));
  }

  if (jminVal !== null && jmaxVal !== null && jminVal > jmaxVal) {
    return invalid(
      _('AmneziaWG jmin must be less than or equal to jmax (max 1280)'),
    );
  }

  for (const sKey of ['s1', 's2', 's3', 's4']) {
    if (amnezia[sKey] !== undefined && `${amnezia[sKey]}`.trim() !== '') {
      const sVal = parseNonNegInt(amnezia[sKey]);
      if (sVal === null || sVal > 1280) {
        return invalid(
          _(
            'AmneziaWG s1-s4 padding values must be integers between 0 and 1280',
          ),
        );
      }
    }
  }

  const hRanges: Array<[number, number]> = [];
  for (const hKey of ['h1', 'h2', 'h3', 'h4']) {
    if (amnezia[hKey] !== undefined && `${amnezia[hKey]}`.trim() !== '') {
      const range = parseHeaderRange(amnezia[hKey]);
      if (!range) {
        return invalid(
          _(
            'AmneziaWG h1-h4 headers must be valid 32-bit integers or min-max ranges',
          ),
        );
      }
      for (const existing of hRanges) {
        if (range[0] <= existing[1] && existing[0] <= range[1]) {
          return invalid(_('AmneziaWG h1-h4 header ranges must not overlap'));
        }
      }
      hRanges.push(range);
    }
  }

  for (const iKey of ['i1', 'i2', 'i3', 'i4', 'i5']) {
    if (amnezia[iKey] !== undefined && amnezia[iKey] !== '') {
      if (
        typeof amnezia[iKey] !== 'string' ||
        amnezia[iKey].trim().length === 0 ||
        amnezia[iKey].length > 4096 ||
        /[\r\n]/.test(amnezia[iKey])
      ) {
        return invalid(
          _(
            'AmneziaWG i1-i5 signature packets must be non-empty single-line strings',
          ),
        );
      }
    }
  }

  return { valid: true, message: _('Valid') };
}

export function validateCidrOrIpList(rawList: string[]): ValidationResult {
  for (const rawItem of rawList) {
    const item = `${rawItem || ''}`.trim();
    if (!item || item.endsWith('/')) {
      return invalid(_('Invalid WireGuard interface address or CIDR'));
    }
    const sub = validateSubnet(item);
    if (!sub.valid) {
      return invalid(_('Invalid WireGuard interface address or CIDR'));
    }
  }
  return { valid: true, message: _('Valid') };
}

function parseRawQueryParams(rawQuery: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!rawQuery) {
    return params;
  }

  for (const pair of rawQuery.split('&')) {
    if (!pair) continue;
    const eqIndex = pair.indexOf('=');
    const rawKey = eqIndex >= 0 ? pair.slice(0, eqIndex) : pair;
    const rawVal = eqIndex >= 0 ? pair.slice(eqIndex + 1) : '';
    const key = safeDecodePercent(rawKey).trim().toLowerCase();
    if (key) {
      params[key] = safeDecodePercent(rawVal).trim();
    }
  }
  return params;
}

function validateReservedParam(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (/^\d+\s*,\s*\d+\s*,\s*\d+$/.test(trimmed)) {
    return trimmed
      .split(',')
      .map((part) => Number(part.trim()))
      .every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
  }
  const bytes = decodeBase64Bytes(trimmed);
  return bytes !== null && bytes.length === 3;
}

export function validateWireGuardUrl(url: string): ValidationResult {
  const trimmed = `${url || ''}`.trim();
  const schemeMatch = trimmed.match(WG_SCHEME_RE);
  if (!schemeMatch) {
    return invalid(
      _(
        'URL must start with wireguard://, wg://, awg://, amneziawg://, or warp://',
      ),
    );
  }

  const scheme = schemeMatch[1].toLowerCase();
  const isWarp = scheme === 'warp';
  const rest = trimmed.slice(schemeMatch[0].length);
  const hashIndex = rest.indexOf('#');
  const withoutHash = hashIndex >= 0 ? rest.slice(0, hashIndex) : rest;
  const queryIndex = withoutHash.indexOf('?');
  const authorityPart =
    queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const rawQuery = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '';

  // Split at the LAST '@' so raw '/' or '+' in base64 Curve25519 userinfo never breaks authority parsing
  const atIndex = authorityPart.lastIndexOf('@');
  const userinfo = atIndex >= 0 ? authorityPart.slice(0, atIndex) : '';
  const hostPortRaw = (
    atIndex >= 0 ? authorityPart.slice(atIndex + 1) : authorityPart
  ).replace(/\/+$/, '');

  const params = parseRawQueryParams(rawQuery);

  // Validate endpoint host / port
  if (isWarp) {
    if (hostPortRaw && hostPortRaw.toLowerCase() !== 'auto') {
      if (hostPortRaw.toLowerCase().startsWith('auto:')) {
        const autoPort = hostPortRaw.slice(5);
        if (!isValidPort(autoPort)) {
          return invalid(_('Port must be a number between 1 and 65535'));
        }
      } else {
        const parsedHp = parseHostPort(hostPortRaw);
        if (parsedHp) {
          if (!isValidPort(parsedHp.port)) {
            return invalid(_('Port must be a number between 1 and 65535'));
          }
        } else if (!isValidHost(hostPortRaw)) {
          return invalid(_('Invalid server host or port in WARP URL'));
        }
      }
    }
  } else {
    const parsedHp = parseHostPort(hostPortRaw);
    if (!parsedHp) {
      return invalid(_('Invalid WireGuard server host or port'));
    }
    if (!isValidPort(parsedHp.port)) {
      return invalid(_('Port must be a number between 1 and 65535'));
    }
  }

  // Extract and validate private key / PSK
  let privateKey =
    params.privatekey || params.private_key || params['private-key'] || '';
  let psk =
    params.psk ||
    params.presharedkey ||
    params.pre_shared_key ||
    params['pre-shared-key'] ||
    '';

  if (userinfo) {
    const colonIdx = userinfo.indexOf(':');
    const userPriv = colonIdx >= 0 ? userinfo.slice(0, colonIdx) : userinfo;
    const userPsk = colonIdx >= 0 ? userinfo.slice(colonIdx + 1) : '';
    if (userPriv && !privateKey) {
      privateKey = userPriv;
    }
    if (userPsk && !psk) {
      psk = userPsk;
    }
  }

  if (!isWarp) {
    if (!privateKey || !isValidCurve25519Key(privateKey)) {
      return invalid(_('Invalid or missing WireGuard private key'));
    }
  } else if (privateKey && !isValidCurve25519Key(privateKey)) {
    return invalid(_('Invalid WireGuard private key in WARP URL'));
  }

  const publicKey =
    params.publickey ||
    params.public_key ||
    params['public-key'] ||
    params.peer_public_key ||
    '';
  if (!isWarp) {
    if (!publicKey || !isValidCurve25519Key(publicKey)) {
      return invalid(_('Invalid or missing WireGuard peer public key'));
    }
  } else if (publicKey && !isValidCurve25519Key(publicKey)) {
    return invalid(_('Invalid WireGuard peer public key in WARP URL'));
  }

  if (psk && !isValidCurve25519Key(psk)) {
    return invalid(_('Invalid WireGuard pre-shared key'));
  }

  const rawAddress = params.address || params.ip || params.local_address || '';
  if (rawAddress) {
    const items = rawAddress
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!items.length) {
      return invalid(_('Invalid WireGuard interface address or CIDR'));
    }
    const addrValidation = validateCidrOrIpList(items);
    if (!addrValidation.valid) {
      return addrValidation;
    }
  }

  const rawAllowedIps = params.allowedips || params.allowed_ips || '';
  if (rawAllowedIps) {
    const items = rawAllowedIps
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const allowedValidation = validateCidrOrIpList(items);
    if (!allowedValidation.valid) {
      return invalid(_('Invalid WireGuard AllowedIPs CIDR'));
    }
  }

  if (params.mtu !== undefined && params.mtu !== '') {
    const mtu = parseNonNegInt(params.mtu);
    if (mtu === null || mtu < 576 || mtu > 65535) {
      return invalid(_('WireGuard MTU must be between 576 and 65535'));
    }
  }

  const rawKeepalive = params.keepalive || params.persistent_keepalive || '';
  if (rawKeepalive) {
    const ka = parseNonNegInt(rawKeepalive);
    if (ka === null || ka > 65535) {
      return invalid(_('WireGuard keepalive must be between 0 and 65535'));
    }
  }

  if (params.reserved !== undefined && params.reserved !== '') {
    if (!validateReservedParam(params.reserved)) {
      return invalid(
        _('WireGuard reserved field must be 3 comma-separated bytes or base64'),
      );
    }
  }

  // Extract AmneziaWG query parameters if any are present
  const awgKeys = [
    'jc',
    'jmin',
    'jmax',
    's1',
    's2',
    's3',
    's4',
    'h1',
    'h2',
    'h3',
    'h4',
    'i1',
    'i2',
    'i3',
    'i4',
    'i5',
  ];
  const awgObj: Record<string, unknown> = {};
  let hasAwg = false;
  for (const key of awgKeys) {
    if (params[key] !== undefined && params[key] !== '') {
      awgObj[key] = params[key];
      hasAwg = true;
    }
  }

  if (hasAwg) {
    const awgValidation = validateAmneziaWgConfig(awgObj, isWarp);
    if (!awgValidation.valid) {
      return awgValidation;
    }
  }

  return { valid: true, message: _('Valid') };
}
