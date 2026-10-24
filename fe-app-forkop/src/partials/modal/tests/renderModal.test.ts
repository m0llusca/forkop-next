// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderModal } from '../renderModal';
import { formatMaskedSingBoxConfig } from '../../../forkop/tabs/diagnostic/helpers/maskDiagnostics';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'E',
    (
      tag: string,
      attrs: Record<string, unknown> = {},
      children: unknown = '',
    ) => {
      const e = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs)) {
        if (typeof value === 'function')
          e.addEventListener(key, value as EventListener);
        else if (value !== undefined) e.setAttribute(key, String(value));
      }
      for (const child of Array.isArray(children) ? children : [children])
        e.append(child instanceof Node ? child : String(child));
      return e;
    },
  );
  vi.stubGlobal('ui', { hideModal: () => document.body.replaceChildren() });
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: false,
  });
});
afterEach(async () => {
  document.body.replaceChildren();
  document.body.classList.remove('modal-overlay-active');
  await tick();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('stops reads when native LuCI hideModal only removes its overlay class without disconnecting the dialog', async () => {
  // Actual LuCI ui.hideModal contract: body.classList.remove('modal-overlay-active'); modalDiv.blur().
  // https://raw.githubusercontent.com/openwrt/luci/master/modules/luci-base/htdocs/luci-static/resources/ui.js
  let calls = 0;
  const body = renderModal('initial', 'logs', {
    getText: async () => {
      calls++;
      return `line ${calls}`;
    },
    refreshMs: 1000,
  });
  const overlay = document.createElement('div');
  overlay.id = 'modal_overlay';
  overlay.append(body);
  document.body.append(overlay);
  document.body.classList.add('modal-overlay-active');
  await tick();
  expect(calls).toBe(1);
  document.body.classList.remove('modal-overlay-active');
  overlay.blur();
  await tick();
  expect(body.isConnected).toBe(true);
  await vi.advanceTimersByTimeAsync(10000);
  expect(calls).toBe(1);
  hide(true);
  hide(false);
  await tick();
  expect(calls).toBe(1);
});
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const button = (body: HTMLElement, label: string) =>
  [...body.querySelectorAll('button')].find((b) => b.textContent === label)!;
function hide(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: hidden,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

it('keeps failed masked output empty and disables exports until explicit raw view', () => {
  const body = renderModal('{"password":"SYNTHETIC_SECRET",', 'config', {
    maskText: formatMaskedSingBoxConfig,
    showMaskValuesToggle: true,
  });
  document.body.append(body);
  expect(body.textContent).not.toContain('SYNTHETIC_SECRET');
  expect(body.querySelector('[role=alert]')?.textContent).toMatch(/mask/i);
  expect(button(body, 'Copy').disabled).toBe(true);
  expect(button(body, 'Download').disabled).toBe(true);
  const toggle = body.querySelector('input')!;
  toggle.checked = false;
  toggle.dispatchEvent(new Event('change'));
  expect(body.querySelector('code')?.textContent).toContain('SYNTHETIC_SECRET');
  expect(body.textContent).toMatch(/raw.*secret/i);
  expect(button(body, 'Copy').disabled).toBe(false);
  toggle.checked = true;
  toggle.dispatchEvent(new Event('change'));
  expect(body.querySelector('code')?.textContent).toBe('');
});

it('pauses hidden polling, resumes once and never overlaps a pending read', async () => {
  let calls = 0;
  let finish!: (text: string) => void;
  const body = renderModal('initial', 'logs', {
    getText: () => {
      calls++;
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    },
    refreshMs: 250,
  });
  document.body.append(body);
  await tick();
  await vi.advanceTimersByTimeAsync(250);
  expect(calls).toBe(1);
  hide(true);
  await vi.advanceTimersByTimeAsync(2000);
  expect(calls).toBe(1);
  finish('obsolete hidden');
  await tick();
  expect(body.querySelector('code')?.textContent).toBe('initial');
  hide(false);
  await tick();
  expect(calls).toBe(2);
  await vi.advanceTimersByTimeAsync(2000);
  expect(calls).toBe(2);
  finish('current');
  await tick();
  expect(body.querySelector('code')?.textContent).toBe('current');
  button(body, 'Close').click();
  await vi.advanceTimersByTimeAsync(10000);
  expect(calls).toBe(2);
});

it('retains the last successful text and reports refresh failure beside retry', async () => {
  let fail = false;
  const body = renderModal('initial', 'logs', {
    getText: async () => {
      if (fail) throw new Error('synthetic');
      return 'latest';
    },
    refreshMs: 1000,
  });
  document.body.append(body);
  await tick();
  await vi.advanceTimersByTimeAsync(1000);
  expect(body.querySelector('code')?.textContent).toBe('latest');
  fail = true;
  button(body, 'Refresh').click();
  await tick();
  expect(body.querySelector('code')?.textContent).toBe('latest');
  expect(body.querySelector('[role=alert]')?.textContent).toMatch(
    /failed.*last success/i,
  );
  fail = false;
  button(body, 'Refresh').click();
  await tick();
  expect(body.querySelector('[role=alert]')?.textContent || '').toBe('');
});

it('keeps a manual copy selection when an unchanged log refresh arrives', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async () => {
        throw new Error('synthetic denial');
      },
    },
  });
  const body = renderModal('unchanged', 'logs', {
    getText: async () => 'unchanged',
    refreshMs: 1000,
  });
  document.body.append(body);
  await tick();
  button(body, 'Copy').click();
  await tick();
  const manual = body.querySelector('textarea')!;
  expect(manual.value).toContain('unchanged');
  manual.focus();
  manual.setSelectionRange(0, 4);
  button(body, 'Refresh').click();
  await tick();
  expect(body.contains(manual)).toBe(true);
  expect(manual.selectionEnd).toBe(4);
  expect(document.activeElement).toBe(manual);
});

it('does no reads when opened hidden, and only one current read on return even if another read is pending', async () => {
  hide(true);
  let calls = 0;
  let finish!: (text: string) => void;
  const body = renderModal('initial', 'logs', {
    getText: () => {
      calls++;
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    },
  });
  document.body.append(body);
  await tick();
  await vi.advanceTimersByTimeAsync(10000);
  expect(calls).toBe(0);
  hide(false);
  await tick();
  expect(calls).toBe(1);
  hide(true);
  hide(false);
  await tick();
  expect(calls).toBe(1);
  finish('old');
  await tick();
  expect(calls).toBe(2);
  expect(body.querySelector('code')?.textContent).toBe('initial');
  finish('fresh');
  await tick();
  expect(body.querySelector('code')?.textContent).toBe('fresh');
  body.remove();
  await tick();
  await vi.advanceTimersByTimeAsync(10000);
  expect(calls).toBe(2);
});

it('discards a pending raw-copy failure after switching back to masked view', async () => {
  let reject!: (reason: Error) => void;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        }),
    },
  });
  const body = renderModal('{"password":"SYNTHETIC_RAW_SECRET"}', 'config', {
    maskText: formatMaskedSingBoxConfig,
    initialMaskValues: false,
    showMaskValuesToggle: true,
  });
  document.body.append(body);
  await tick();
  button(body, 'Copy').click();
  const toggle = body.querySelector('input')!;
  toggle.checked = true;
  toggle.dispatchEvent(new Event('change'));
  reject(new Error('synthetic denial'));
  await tick();
  expect(body.textContent).not.toContain('SYNTHETIC_RAW_SECRET');
  expect(body.querySelector('textarea')).toBeNull();
  expect(button(body, 'Copy').disabled).toBe(false);
});
