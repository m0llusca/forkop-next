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

it('replaces its global manual fallback on repeated failures without disturbing other content or selection', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: () => false,
  });
  const unrelated = document.createElement('div');
  unrelated.className = 'fkp-copy-feedback';
  unrelated.textContent = 'Unrelated content';
  const button = document.createElement('button');
  const selected = document.createTextNode('Keep this selection');
  document.body.append(unrelated, button, selected);
  const range = document.createRange();
  range.setStart(selected, 5);
  range.setEnd(selected, 9);
  window.getSelection()!.addRange(range);
  button.focus();

  expect(await copyToClipboard('FIRST_COPY')).toBe(false);
  expect(await copyToClipboard('LATEST_COPY')).toBe(false);

  expect(document.querySelectorAll('textarea')).toHaveLength(1);
  expect(document.querySelector('textarea')!.value).toBe('LATEST_COPY');
  expect(document.querySelectorAll('.fkp-copy-feedback')).toHaveLength(2);
  expect(unrelated.textContent).toBe('Unrelated content');
  expect(document.activeElement).toBe(button);
  expect(window.getSelection()!.toString()).toBe('this');
  const select = document.querySelector<HTMLButtonElement>(
    '.fkp-copy-feedback button',
  )!;
  select.click();
  const manual = document.querySelector('textarea')!;
  expect(document.activeElement).toBe(manual);
  expect(manual.selectionStart).toBe(0);
  expect(manual.selectionEnd).toBe(11);
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

it('keeps focus and the manual text selection when a global copy retry fails again', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async () => {
        throw Error('synthetic denial');
      },
    },
  });
  await copyToClipboard('SYNTHETIC_COPY');
  const manual = document.querySelector('textarea')!;
  manual.focus();
  manual.setSelectionRange(2, 6);

  expect(await copyToClipboard('SYNTHETIC_COPY')).toBe(false);

  expect(document.querySelectorAll('textarea')).toHaveLength(1);
  expect(document.activeElement).toBe(manual);
  expect(manual.selectionStart).toBe(2);
  expect(manual.selectionEnd).toBe(6);
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
