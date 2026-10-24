import { showToast } from './showToast';

let globalFallback: HTMLElement | undefined;

export async function copyToClipboard(
  text: string,
  feedback?: HTMLElement,
): Promise<boolean> {
  const previousFocus = document.activeElement as HTMLElement | null;
  const selection = window.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, i) =>
        selection.getRangeAt(i).cloneRange(),
      )
    : [];
  let textarea: HTMLTextAreaElement | undefined;
  let usedSelection = false;
  const manualText = () => {
    textarea ??= document.createElement('textarea');
    if (textarea.value !== text) textarea.value = text;
    textarea.readOnly = true;
    textarea.setAttribute('aria-label', _('Text to copy manually'));
    return textarea;
  };
  const announce = (message: string, failed: boolean) => {
    if (feedback) {
      feedback.setAttribute('role', failed ? 'alert' : 'status');
      feedback.setAttribute('aria-live', failed ? 'assertive' : 'polite');
      feedback.textContent = message;
    } else showToast(message, failed ? 'error' : 'success');
  };
  try {
    feedback?.replaceChildren();
    if (navigator.clipboard?.writeText)
      await navigator.clipboard.writeText(text);
    else {
      document.body.append(manualText());
      usedSelection = true;
      textarea!.select();
      if (!document.execCommand('copy')) throw new Error('Clipboard refused');
    }
    textarea?.remove();
    announce(_('Copied'), false);
    return true;
  } catch {
    announce(
      _('Failed to copy! Select the text and copy manually, or retry.'),
      true,
    );
    const host =
      feedback ??
      (globalFallback?.isConnected
        ? globalFallback
        : (globalFallback = document.createElement('div')));
    if (!feedback) {
      host.className = 'fkp-copy-feedback';
      const manual = host.querySelector('textarea');
      if (manual) {
        textarea?.remove();
        textarea = manual;
      }
      if (!host.isConnected)
        (previousFocus?.parentElement ?? document.body).append(host);
    }
    const select =
      host.querySelector('button') ?? document.createElement('button');
    select.type = 'button';
    select.textContent = _('Select text');
    select.onclick = () => {
      textarea!.focus();
      textarea!.select();
    };
    if (manualText().parentElement !== host) host.append(textarea!);
    if (select.parentElement !== host) host.append(select);
    return false;
  } finally {
    if (usedSelection) previousFocus?.focus({ preventScroll: true });
    if (usedSelection && selection && ranges.length) {
      selection.removeAllRanges();
      for (const range of ranges) selection.addRange(range);
    }
  }
}
