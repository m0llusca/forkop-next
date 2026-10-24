// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { renderDeviceProfileTools } from '../tools';
import type { Request } from '../advanced';

const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(() => document.body.replaceChildren());
const routes = (label: string) => ({
  success: true,
  data: { sections: [{ name: 'vpn', label }] },
});
const retry = (root: HTMLElement) =>
  [...root.querySelectorAll('button')]
    .find((button) => button.textContent === 'Обновить маршруты')!
    .click();
const result = (root: HTMLElement) =>
  root.querySelector('[aria-label="Результат игрового пресета"]')!.textContent;
function deferred() {
  let resolve!: (value: Awaited<ReturnType<Request>>) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Awaited<ReturnType<Request>>>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
it.each(['response', 'rejection'])(
  'keeps a successful retry and entered fields when an older initial read fails (%s)',
  async (failure) => {
    const old = deferred();
    const request: Request = async (action) =>
      action === 'status'
        ? routes('Fresh route')
        : { success: true, data: { items: [] } };
    const initial: Request = (action, payload) =>
      action === 'status' ? old.promise : request(action, payload);
    const root = renderDeviceProfileTools(request, initial, 'devices');
    document.body.append(root);
    const field = root.querySelector<HTMLInputElement>(
      '[aria-label="Адрес устройства"]',
    )!;
    field.value = '192.168.1.42';
    retry(root);
    await tick();
    expect(result(root)).toBe('Маршруты обновлены.');
    if (failure === 'response')
      old.resolve({ success: false, error: 'old offline' });
    else old.reject(Error('old offline'));
    await tick();
    expect(result(root)).toBe('Маршруты обновлены.');
    expect(
      root.querySelector('[aria-label="Маршрут устройства"]')!.textContent,
    ).toContain('Fresh route');
    expect(field.value).toBe('192.168.1.42');
  },
);
it('keeps the latest refresh failure when an older button refresh later succeeds', async () => {
  const old = deferred();
  let reads = 0;
  const request: Request = async (action) =>
    action === 'status'
      ? ++reads === 1
        ? routes('Initial')
        : old.promise
      : { success: true, data: { items: [] } };
  const root = renderDeviceProfileTools(request, request, 'devices');
  document.body.append(root);
  await tick();
  retry(root);
  await tick();
  const latest: Request = async () => ({
    success: false,
    error: 'fresh offline',
  });
  root.dispatchEvent(
    new CustomEvent('forkop:refresh-tools', { detail: { read: latest } }),
  );
  await tick();
  expect(result(root)).toContain('Не удалось загрузить маршруты');
  old.resolve(routes('Obsolete route'));
  await tick();
  expect(result(root)).toContain('Не удалось загрузить маршруты');
  expect(
    root.querySelector('[aria-label="Маршрут устройства"]')!.textContent,
  ).not.toContain('Obsolete route');
});
it('ignores an older event refresh failure after a newer event refresh succeeds', async () => {
  const old = deferred();
  const request: Request = async (action) =>
    action === 'status'
      ? routes('Initial')
      : { success: true, data: { items: [] } };
  const root = renderDeviceProfileTools(request, request, 'devices');
  document.body.append(root);
  await tick();
  root.dispatchEvent(
    new CustomEvent('forkop:refresh-tools', {
      detail: { read: () => old.promise },
    }),
  );
  root.dispatchEvent(
    new CustomEvent('forkop:refresh-tools', {
      detail: { read: async () => routes('Newest route') },
    }),
  );
  await tick();
  const freshStatus = result(root);
  expect(freshStatus).toBe('Маршруты обновлены.');
  old.reject(Error('obsolete failure'));
  await tick();
  expect(result(root)).toBe(freshStatus);
  expect(result(root)).not.toContain('Не удалось загрузить маршруты');
  expect(
    root.querySelector('[aria-label="Маршрут устройства"]')!.textContent,
  ).toContain('Newest route');
});
