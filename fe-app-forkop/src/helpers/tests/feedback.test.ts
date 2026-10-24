// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { copyToClipboard } from '../copyToClipboard';
import { showToast } from '../showToast';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('does not announce clipboard success when the browser refuses copying, and retains manual selection', async () => {
  const button = document.createElement('button');
  document.body.append(button);
  button.focus();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: () => false,
  });
  await copyToClipboard('SYNTHETIC_COPY');
  expect(document.querySelector('.toast-success')).toBeNull();
  expect(document.querySelector('[role=alert]')?.textContent).toMatch(/copy/i);
  expect(document.querySelector('textarea')?.value).toBe('SYNTHETIC_COPY');
  expect(document.activeElement).toBe(button);
});

it('waits for clipboard confirmation and restores the initiating focus', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: () => pending },
  });
  const button = document.createElement('button');
  document.body.append(button);
  button.focus();
  const work = copyToClipboard('SYNTHETIC_COPY');
  expect(document.querySelector('.toast-success')).toBeNull();
  finish();
  await work;
  expect(document.querySelector('[role=status]')?.textContent).toBe('Copied');
  expect(document.activeElement).toBe(button);
  expect(document.querySelector('textarea')).toBeNull();
});

it('does not pull focus back after the user moves while clipboard confirmation is pending', async () => {
  let finish!: () => void;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    },
  });
  const button = document.createElement('button');
  const input = document.createElement('input');
  document.body.append(button, input);
  button.focus();
  const work = copyToClipboard('SYNTHETIC_COPY');
  input.focus();
  finish();
  await work;
  expect(document.activeElement).toBe(input);
});

it('announces ordinary status politely and errors urgently', () => {
  vi.useFakeTimers();
  showToast('Done', 'success');
  showToast('Failed', 'error');
  expect(
    document.querySelector('[role=status]')?.getAttribute('aria-live'),
  ).toBe('polite');
  expect(
    document.querySelector('[role=alert]')?.getAttribute('aria-live'),
  ).toBe('assertive');
});

it.each(['reject', 'throw'])(
  'keeps browser clipboard %s failures beside the action, with a selectable manual fallback',
  async (mode) => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value:
        mode === 'reject'
          ? {
              writeText: async () => {
                throw new Error('synthetic denial');
              },
            }
          : undefined,
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: () => {
        throw new Error('synthetic browser error');
      },
    });
    const feedback = document.createElement('div');
    document.body.append(feedback);
    expect(await copyToClipboard('SYNTHETIC_COPY', feedback)).toBe(false);
    expect(feedback.getAttribute('role')).toBe('alert');
    expect(document.querySelector('.toast-success')).toBeNull();
    const select = feedback.querySelector('button')!;
    select.click();
    const manual = feedback.querySelector('textarea')!;
    expect(document.activeElement).toBe(manual);
    expect(manual.selectionStart).toBe(0);
    expect(manual.selectionEnd).toBe(14);
  },
);
