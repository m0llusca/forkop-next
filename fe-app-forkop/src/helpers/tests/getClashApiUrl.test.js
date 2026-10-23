import { describe, expect, it, vi } from 'vitest';
import { canUseDirectClashApi } from '../getClashApiUrl';

describe('canUseDirectClashApi', () => {
  it('allows direct Clash API access from HTTP LuCI', () => {
    vi.stubGlobal('window', {
      location: { hostname: 'router.example', protocol: 'http:' },
    });

    expect(
      canUseDirectClashApi({ enable_yacd: '1', yacd_secret_key: 'secret' }),
    ).toBe(true);
  });

  it.each([
    undefined,
    {},
    { enable_yacd: '0', yacd_secret_key: 'secret' },
    { enable_yacd: '1', yacd_secret_key: '' },
  ])('blocks a private controller on HTTP LuCI: %j', (settings) => {
    vi.stubGlobal('window', {
      location: { hostname: 'router.example', protocol: 'http:' },
    });
    expect(canUseDirectClashApi(settings)).toBe(false);
  });

  it('blocks direct Clash API access from HTTPS LuCI', () => {
    vi.stubGlobal('window', {
      location: { hostname: 'router.example', protocol: 'https:' },
    });

    expect(
      canUseDirectClashApi({ enable_yacd: '1', yacd_secret_key: 'secret' }),
    ).toBe(false);
  });

  it('blocks direct Clash API access outside a browser location', () => {
    vi.stubGlobal('window', undefined);

    expect(canUseDirectClashApi()).toBe(false);
  });
});
