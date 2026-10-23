type ReloadTarget = {
  addEventListener: EventTarget['addEventListener'];
  location: { reload(): void };
  setTimeout: (callback: () => void, delay: number) => unknown;
};
const registered = new WeakSet<object>();
export function registerConfigurationReload(
  target: ReloadTarget = window,
): void {
  if (registered.has(target)) return;
  registered.add(target);
  target.addEventListener(
    'forkop:configuration-changed',
    () => {
      target.setTimeout(() => target.location.reload(), 200);
    },
    { once: true },
  );
}
