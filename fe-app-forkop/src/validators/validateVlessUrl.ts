import { ValidationResult } from './types';
import { parseQueryString } from '../helpers/parseQueryString';
import { isValidPort, parseHostPort } from './hostPort';

export function validateVlessUrl(url: string): ValidationResult {
  try {
    if (!url.startsWith('vless://'))
      return {
        valid: false,
        message: _('Invalid VLESS URL: must start with vless://'),
      };

    if (/\s/.test(url))
      return {
        valid: false,
        message: _('Invalid VLESS URL: must not contain spaces'),
      };

    const body = url.slice('vless://'.length);

    const [mainPart] = body.split('#');

    const hasQuery = mainPart.includes('?');
    const [userHostPort, queryString = ''] = mainPart.split('?');

    if (!userHostPort)
      return {
        valid: false,
        message: _('Invalid VLESS URL: missing host and UUID'),
      };

    const atIndex = userHostPort.lastIndexOf('@');
    const userPart = atIndex >= 0 ? userHostPort.slice(0, atIndex) : '';
    const hostPortPart =
      atIndex >= 0 ? userHostPort.slice(atIndex + 1).split('/')[0] : '';

    if (!userPart)
      return { valid: false, message: _('Invalid VLESS URL: missing UUID') };

    if (!hostPortPart)
      return { valid: false, message: _('Invalid VLESS URL: missing server') };

    const parsedHostPort = parseHostPort(hostPortPart);
    if (!parsedHostPort)
      return {
        valid: false,
        message: _('Invalid VLESS URL: invalid host and port'),
      };
    const { host, port } = parsedHostPort;

    if (!host)
      return {
        valid: false,
        message: _('Invalid VLESS URL: missing hostname'),
      };

    if (!port)
      return { valid: false, message: _('Invalid VLESS URL: missing port') };

    const cleanedPort = port.replace('/', '');
    if (!isValidPort(cleanedPort))
      return {
        valid: false,
        message: _('Invalid VLESS URL: invalid port number'),
      };

    if (!hasQuery) {
      return { valid: true, message: _('Valid') };
    }

    if (!queryString)
      return {
        valid: false,
        message: _('Invalid VLESS URL: missing query parameters'),
      };

    const params = parseQueryString(queryString);

    const validTypes = [
      'tcp',
      'raw',
      'udp',
      'grpc',
      'http',
      'httpupgrade',
      'xhttp',
      'ws',
      'kcp',
    ];
    const validSecurities = ['tls', 'reality', 'none'];
    const transportType = params.type || 'tcp';

    if (!validTypes.includes(transportType))
      return {
        valid: false,
        message: _('Invalid VLESS URL: unsupported or missing type'),
      };

    if (!params.security || !validSecurities.includes(params.security))
      return {
        valid: false,
        message: _('Invalid VLESS URL: unsupported or missing security'),
      };

    if (params.security === 'reality') {
      if (!params.pbk)
        return {
          valid: false,
          message: _('Invalid VLESS URL: missing pbk for reality'),
        };
      if (!params.fp)
        return {
          valid: false,
          message: _('Invalid VLESS URL: missing fp for reality'),
        };
    }

    if (params.flow === 'xtls-rprx-vision-udp443') {
      return {
        valid: false,
        message: _(
          'Invalid VLESS URL: flow xtls-rprx-vision-udp443 is not supported',
        ),
      };
    }

    return { valid: true, message: _('Valid') };
  } catch (_e) {
    return { valid: false, message: _('Invalid VLESS URL: parsing failed') };
  }
}
