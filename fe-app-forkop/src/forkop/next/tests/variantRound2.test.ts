// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { renderDeviceProfileTools } from '../tools';
const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it('keeps the latest selected file when an earlier file read completes late', async () => {
  const request = vi.fn(async (action: string) => ({
    success: true,
    data: action === 'status' ? { sections: [] } : { items: [] },
  }));
  const root = renderDeviceProfileTools(request);
  document.body.append(root);
  await flush();
  const file = root.querySelector<HTMLInputElement>(
    '[aria-label="Файл профиля"]',
  )!;
  const config = root.querySelector<HTMLTextAreaElement>(
    '[aria-label="Конфигурация профиля"]',
  )!;
  const name = root.querySelector<HTMLInputElement>(
    '[aria-label="Название импортируемого профиля"]',
  )!;
  let finishOld!: (text: string) => void;
  const old = {
    name: 'Old.uci',
    text: () =>
      new Promise<string>((resolve) => {
        finishOld = resolve;
      }),
  };
  const latest = {
    name: 'Latest.uci',
    text: async () => 'config forkop latest',
  };
  Object.defineProperty(file, 'files', { configurable: true, value: [old] });
  file.dispatchEvent(new Event('change'));
  Object.defineProperty(file, 'files', { configurable: true, value: [latest] });
  file.dispatchEvent(new Event('change'));
  await flush();
  expect(name.value).toBe('Latest');
  expect(config.value).toBe('config forkop latest');
  finishOld('config forkop old');
  await flush();
  expect(config.value).toBe('config forkop latest');
});

it('does not restore a compatibility result for a section changed while the request was pending', async () => {
  const { renderCompatibilityPanel } = await import('../compatibility');
  let finish!: (value: { success: boolean; data: unknown }) => void;
  const request = vi.fn((action: string) =>
    action === 'status'
      ? Promise.resolve({
          success: true,
          data: { sections: [{ name: 'A' }, { name: 'B' }] },
        })
      : new Promise<{ success: boolean; data: unknown }>((resolve) => {
          finish = resolve;
        }),
  );
  const root = renderCompatibilityPanel(request);
  document.body.append(root);
  await flush();
  const [section, outbound] = root.querySelectorAll('select');
  const [compare, handshake] = root.querySelectorAll('button');
  expect(section.value).toBe('A');
  compare.click();
  section.value = 'B';
  section.dispatchEvent(new Event('change'));
  expect(handshake.disabled).toBe(true);
  finish({
    success: true,
    data: {
      status: 'verified',
      outbounds: [{ outbound_tag: 'server-A', label: 'Server A' }],
    },
  });
  await flush();
  expect(section.value).toBe('B');
  expect(outbound.options.length).toBe(0);
  expect(handshake.disabled).toBe(true);
});

it.each(['deselect', 'reject'])(
  'ignores an obsolete file read after %s',
  async (mode) => {
    const root = renderDeviceProfileTools(async (action) => ({
      success: true,
      data: action === 'status' ? { sections: [] } : { items: [] },
    }));
    document.body.append(root);
    await flush();
    const file = root.querySelector<HTMLInputElement>(
      '[aria-label="Файл профиля"]',
    )!;
    const config = root.querySelector<HTMLTextAreaElement>(
      '[aria-label="Конфигурация профиля"]',
    )!;
    const output = root.querySelector(
      'output[aria-label="Результат профиля"]',
    )!;
    let resolve!: (text: string) => void;
    let reject!: (error: Error) => void;
    Object.defineProperty(file, 'files', {
      configurable: true,
      value: [
        {
          name: 'Old.uci',
          text: () =>
            new Promise<string>((yes, no) => {
              resolve = yes;
              reject = no;
            }),
        },
      ],
    });
    file.dispatchEvent(new Event('change'));
    Object.defineProperty(file, 'files', {
      configurable: true,
      value:
        mode === 'deselect'
          ? []
          : [{ name: 'New.uci', text: async () => 'new config' }],
    });
    file.dispatchEvent(new Event('change'));
    await flush();
    const expectedMessage = output.textContent;
    if (mode === 'deselect') resolve('old config');
    else reject(new Error('obsolete file read'));
    await flush();
    expect(config.value).toBe(mode === 'deselect' ? '' : 'new config');
    expect(output.textContent).toBe(expectedMessage);
  },
);

it.each(['resolve', 'reject'])(
  'keeps compatibility disabled after section changes during a probe (%s)',
  async (mode) => {
    const { renderCompatibilityPanel } = await import('../compatibility');
    let finish!: (value: { success: boolean; data: unknown }) => void;
    let fail!: (error: Error) => void;
    const request = async (
      action: string,
      payload?: Record<string, unknown>,
    ) => {
      if (action === 'status')
        return {
          success: true,
          data: { sections: [{ name: 'A' }, { name: 'B' }] },
        };
      if (!payload?.probe)
        return {
          success: true,
          data: {
            status: 'probe_required',
            outbounds: [{ outbound_tag: 'server-A' }],
          },
        };
      return new Promise<{ success: boolean; data: unknown }>((yes, no) => {
        finish = yes;
        fail = no;
      });
    };
    const root = renderCompatibilityPanel(request);
    document.body.append(root);
    await flush();
    const [section] = root.querySelectorAll('select');
    const [compare, handshake] = root.querySelectorAll('button');
    compare.click();
    await flush();
    root.querySelector<HTMLInputElement>(
      '[name="compatibility_domain"]',
    )!.value = 'example.org';
    handshake.click();
    section.value = 'B';
    section.dispatchEvent(new Event('change'));
    const message = root.querySelector('[role="status"]')!.textContent;
    if (mode === 'resolve')
      finish({ success: true, data: { status: 'verified', outbounds: [] } });
    else fail(new Error('old probe failed'));
    await flush();
    expect(handshake.disabled).toBe(true);
    expect(root.querySelector('[role="status"]')!.textContent).toBe(message);
  },
);
