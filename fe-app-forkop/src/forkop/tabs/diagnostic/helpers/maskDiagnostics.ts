const MASKED_VALUE = 'MASKED';

const SING_BOX_MASKED_KEYS = new Set([
  'auth_key',
  'auth_str',
  'certificate',
  'certificate_path',
  'client_id',
  'control_url',
  'exit_node',
  'headers',
  'hostname',
  'key',
  'key_path',
  'listen',
  'listen_port',
  'obfs',
  'peer_public_key',
  'pre_shared_key',
  'reserved',
  'service_name',
  'token',
  'users',
  'username',
  'uuid',
  'server',
  'server_name',
  'secret',
  'password',
  'private_key',
  'public_key',
  'short_id',
  'fingerprint',
  'server_port',
  'server_ports',
  'advertise_routes',
  'domain',
  'domain_suffix',
  'domain_keyword',
  'domain_regex',
  'ip_cidr',
  'source_ip_cidr',
]);

const FORKOP_MASK_AFTER_TOKEN = [
  'option proxy_string',
  'option hwid',
  'option subscription_hwid',
  'option subscription_url',
  'list subscription_urls',
  'list urltest_proxy_links',
  'list selector_proxy_links',
  'list server_users',
  'option server_uuid',
  'option server_username',
  'option server_password',
  'option mtproto_secret',
  'option hysteria2_obfs_password',
  'option reality_private_key',
  'option reality_public_key',
  'option reality_short_id',
  'list reality_short_id',
  'option yacd_secret_key',
  'option pre_shared_key',
  'option private_key',
  'option public_key',
  'option preshared_key',
  'option auth_token',
  'option token',
  'option secret',
  'option key',
  'option passphrase',
  'option wireguard_private_key',
  'option amneziawg_private_key',
];

const FORKOP_MASK_AFTER_TOKEN_SPACE = [
  'option outbound_json',
  'list outbound_jsons',
  'option inbound_json',
  'list inbound_jsons',
  'list domain',
  'list domain_suffix',
  'list domain_keyword',
  'list domain_regex',
  'list ip_cidr',
  'list source_ip_cidr',
  'list fully_routed_ips',
  'option dns_server',
  'option bootstrap_dns_server',
  'option domain_resolver_dns_server',
  'list dns_server',
  'list bootstrap_dns_server',
  'list domain_resolver_dns_server',
  'option listen',
  'option listen_port',
  'option public_host',
  'option mtproto_faketls',
  'option mtproto_domain_fronting_ip',
  'option tls_server_name',
  'option reality_handshake_server',
  'option reality_handshake_server_port',
  'option transport_host',
  'list transport_hosts',
  'option tailscale_auth_key',
  'option tailscale_control_url',
  'option tailscale_hostname',
  'list tailscale_advertise_routes',
  'option tailscale_ephemeral',
  'option tailscale_exit_node',
  'option tailscale_exit_node_allow_lan_access',
  'option mixed_proxy_username',
  'option mixed_proxy_password',
  'option ipaddr',
  'option ip6addr',
  'option ip6prefix',
  'option netmask',
  'option gateway',
  'option ip6gw',
  'list ipaddr',
  'list ip6addr',
  'option macaddr',
  'option clientid',
  'option vendorid',
  'option endpoint_host',
  'option peer_pubkey',
  'option username',
  'option password',
  'option private_key',
  'option url',
];

const MULTILINE_JSON_TOKENS = [
  'option outbound_json',
  'list outbound_jsons',
  'option inbound_json',
  'list inbound_jsons',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSpaceChar(value: string) {
  return value === ' ' || value === '\t' || value === '\r' || value === '\n';
}

function normalizeDirectiveSpacing(line: string) {
  return line.replace(/^(\s*(?:option|list))\s+([^\s]+)\s+/, '$1 $2 ');
}

function maskAfterToken(line: string, token: string) {
  const position = line.indexOf(token);

  return position < 0
    ? line
    : `${line.slice(0, position)}${token} '${MASKED_VALUE}'`;
}

function maskAfterTokenSpace(line: string, token: string) {
  const position = line.indexOf(token);

  if (position < 0) {
    return line;
  }

  const spacePosition = position + token.length;

  if (
    spacePosition >= line.length ||
    !isSpaceChar(line.slice(spacePosition, spacePosition + 1))
  ) {
    return line;
  }

  return `${line.slice(0, spacePosition + 1)}'${MASKED_VALUE}'`;
}

function maskOptionPath(line: string, token: string) {
  const position = line.indexOf(token);

  if (position < 0) {
    return line;
  }

  const slashOffset = line.slice(position + token.length).indexOf('/');

  if (slashOffset < 0) {
    return line;
  }

  const slash = slashOffset + position + token.length;
  const quoteOffset = line.slice(slash + 1).indexOf("'");

  if (quoteOffset < 0) {
    return line;
  }

  const quote = quoteOffset + slash + 1;

  return `${line.slice(0, slash)}/MASKED'${line.slice(quote + 1)}`;
}

const WG_WARP_URI_IN_TEXT_RE =
  /\b(wireguard|wg|awg|amneziawg|warp):\/\/[^\s'"]+/gi;
const SENSITIVE_URI_QUERY_KEY_RE =
  /^(privatekey|private_key|private-key|psk|presharedkey|pre_shared_key|pre-shared-key|token|auth_token|license|license_key|secret)$/i;
const IPV6_ULA_IN_TEXT_RE =
  /\b(?:f[cd][0-9a-f]{2}:[0-9a-f:]*:[0-9a-f:]*(?:\/\d{1,3})?)\b/gi;
const FAKEIP_V6_PREFIX_RE = /^2001:0*2(?::|$)/i;

function maskWgWarpUriInText(rawUri: string): string {
  const schemeIdx = rawUri.indexOf('://');
  if (schemeIdx < 0) return rawUri;

  const schemePrefix = rawUri.slice(0, schemeIdx + 3);
  const rest = rawUri.slice(schemeIdx + 3);
  const hashIdx = rest.indexOf('#');
  const hashSuffix = hashIdx >= 0 ? rest.slice(hashIdx) : '';
  const withoutHash = hashIdx >= 0 ? rest.slice(0, hashIdx) : rest;
  const queryIdx = withoutHash.indexOf('?');
  const authority =
    queryIdx >= 0 ? withoutHash.slice(0, queryIdx) : withoutHash;
  const rawQuery = queryIdx >= 0 ? withoutHash.slice(queryIdx + 1) : null;

  const lastAt = authority.lastIndexOf('@');
  const maskedAuthority =
    lastAt >= 0 ? `[REDACTED]@${authority.slice(lastAt + 1)}` : authority;

  if (rawQuery === null) {
    return `${schemePrefix}${maskedAuthority}${hashSuffix}`;
  }

  const maskedPairs = rawQuery.split('&').map((pair) => {
    const eqIdx = pair.indexOf('=');
    if (eqIdx < 0) return pair;
    const rawKey = pair.slice(0, eqIdx);
    let decodedKey = rawKey;
    try {
      decodedKey = decodeURIComponent(rawKey);
    } catch {
      decodedKey = rawKey;
    }
    if (SENSITIVE_URI_QUERY_KEY_RE.test(decodedKey.trim())) {
      return `${rawKey}=[REDACTED]`;
    }
    return pair;
  });

  return `${schemePrefix}${maskedAuthority}?${maskedPairs.join('&')}${hashSuffix}`;
}

function maskFreeTextWgWarpAndUla(line: string): string {
  const withMaskedUris = line.replace(WG_WARP_URI_IN_TEXT_RE, (match) =>
    maskWgWarpUriInText(match),
  );

  return withMaskedUris.replace(IPV6_ULA_IN_TEXT_RE, (match) => {
    if (FAKEIP_V6_PREFIX_RE.test(match)) {
      return match;
    }
    return '[REDACTED]';
  });
}

function maskGlobalCheckLine(line: string) {
  let maskedLine = normalizeDirectiveSpacing(line);

  for (const token of FORKOP_MASK_AFTER_TOKEN) {
    maskedLine = maskAfterToken(maskedLine, token);
  }

  for (const token of FORKOP_MASK_AFTER_TOKEN_SPACE) {
    maskedLine = maskAfterTokenSpace(maskedLine, token);
  }

  maskedLine = maskOptionPath(maskedLine, "option dns_server '");
  maskedLine = maskOptionPath(maskedLine, "list dns_server '");
  maskedLine = maskOptionPath(
    maskedLine,
    "option domain_resolver_dns_server '",
  );
  maskedLine = maskFreeTextWgWarpAndUla(maskedLine);
  return maskedLine;
}

function hasUnescapedClosingSingleQuote(value: string) {
  const cleaned = value.replace(/'\\''/g, '');
  return cleaned.includes("'");
}

function maskMultilineContinuation(line: string) {
  const leadingSpace = line.match(/^\s*/)?.[0] ?? '';
  const hasClosingQuote = hasUnescapedClosingSingleQuote(line);

  return `${leadingSpace}${MASKED_VALUE}${hasClosingQuote ? "'" : ''}`;
}

export function maskSingBoxConfigValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskSingBoxConfigValue(item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SING_BOX_MASKED_KEYS.has(key)
          ? MASKED_VALUE
          : maskSingBoxConfigValue(item),
      ]),
    );
  }

  return value;
}

export function stringifySingBoxConfig(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export function formatMaskedSingBoxConfig(value: unknown) {
  const config = typeof value === 'string' ? JSON.parse(value) : value;
  if (!isRecord(config))
    throw new Error('Unsupported diagnostic configuration');
  return JSON.stringify(maskSingBoxConfigValue(config), null, 2);
}

export function maskGlobalCheckText(text: string = '') {
  let inMaskedMultiline = false;

  return `${text}`
    .split('\n')
    .map((line) => {
      if (inMaskedMultiline) {
        if (hasUnescapedClosingSingleQuote(line)) {
          inMaskedMultiline = false;
        }

        return maskMultilineContinuation(line);
      }

      const normalizedLine = normalizeDirectiveSpacing(line);
      const maskedLine = maskGlobalCheckLine(line);

      if (MULTILINE_JSON_TOKENS.some((t) => normalizedLine.includes(t))) {
        const firstQuote = normalizedLine.indexOf("'");

        if (
          firstQuote >= 0 &&
          !hasUnescapedClosingSingleQuote(normalizedLine.slice(firstQuote + 1))
        ) {
          inMaskedMultiline = true;
        }
      }

      return maskedLine;
    })
    .join('\n');
}
