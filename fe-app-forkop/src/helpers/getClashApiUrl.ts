function getWindowLocation(): Location | undefined {
  return typeof window !== 'undefined' ? window.location : undefined;
}

export function canUseDirectClashApi(settings?: {
  enable_yacd?: string;
  yacd_secret_key?: string;
}): boolean {
  const location = getWindowLocation();

  return (
    settings?.enable_yacd === '1' &&
    Boolean(settings.yacd_secret_key) &&
    typeof location?.hostname === 'string' &&
    location.hostname !== '' &&
    location.protocol !== 'https:'
  );
}

function formatUrlHost(hostname: string): string {
  if (hostname.includes(':') && !hostname.startsWith('[')) {
    return `[${hostname}]`;
  }
  return hostname;
}

export function getClashWsUrl(): string {
  const host = formatUrlHost(window.location.hostname);

  return `ws://${host}:9090`;
}

export function getClashHttpUrl(): string {
  const host = formatUrlHost(window.location.hostname);

  return `http://${host}:9090`;
}

export function getClashUIUrl(): string {
  const host = formatUrlHost(window.location.hostname);

  return `http://${host}:9090/ui`;
}
