function safeDecodeComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseQueryString(query: string): Record<string, string> {
  const clean = query.startsWith('?') ? query.slice(1) : query;

  return clean
    .split('&')
    .filter(Boolean)
    .reduce(
      (acc, pair) => {
        const eqIdx = pair.indexOf('=');
        const rawKey = eqIdx >= 0 ? pair.slice(0, eqIdx) : pair;
        const rawValue = eqIdx >= 0 ? pair.slice(eqIdx + 1) : '';

        if (!rawKey) {
          return acc;
        }

        const key = safeDecodeComponent(rawKey);
        const value = safeDecodeComponent(rawValue);

        return { ...acc, [key]: value };
      },
      {} as Record<string, string>,
    );
}
