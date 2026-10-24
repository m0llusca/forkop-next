type ReloadTarget = {
  addEventListener: EventTarget['addEventListener'];
};
type ConfigurationAdapter = {
  beforeChange(): Promise<void>;
  changed(): Promise<void>;
  settled(): void;
};
const registered = new WeakMap<object, ConfigurationAdapter | undefined>();
// Keep the public entry point for native LuCI; changes refresh its map, not the page.
export function registerConfigurationReload(
  target: ReloadTarget = window,
  adapter?: ConfigurationAdapter,
): void {
  if (registered.has(target)) {
    if (adapter) registered.set(target, adapter);
    return;
  }
  registered.set(target, adapter);
  for (const [event, method] of [
    ['forkop:configuration-changing', 'beforeChange'],
    ['forkop:configuration-changed', 'changed'],
  ] as const)
    target.addEventListener(event, (event) => {
      const active = registered.get(target);
      if (active)
        (
          event as CustomEvent<{ waitUntil(p: Promise<void>): void }>
        ).detail?.waitUntil(active[method]());
    });
  target.addEventListener('forkop:configuration-settled', () =>
    registered.get(target)?.settled(),
  );
}
