import { renderButton } from '../button/renderButton';
import { copyToClipboard } from '../../helpers/copyToClipboard';
import { downloadAsTxt } from '../../helpers/downloadAsTxt';

interface ModalTextContext {
  maskValues: boolean;
}
interface RenderModalOptions {
  getText?: (context: ModalTextContext) => string | Promise<string>;
  maskText?: (text: string) => string;
  refreshMs?: number;
  initialAutoRefresh?: boolean;
  showAutoRefreshToggle?: boolean;
  showMaskValuesToggle?: boolean;
  initialMaskValues?: boolean;
  startAtEnd?: boolean;
  autoRefreshLabel?: string;
  maskValuesLabel?: string;
}

export function renderModal(
  text: string,
  name: string,
  options?: RenderModalOptions,
) {
  let rawText = text ?? '';
  let currentText = '';
  let exportReady = false;
  let refreshInFlight = false;
  let copyInFlight = false;
  let pendingForcedRefresh = false;
  let pendingResume = false;
  let session = 0;
  let mounted = false;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let autoRefreshEnabled =
    options?.initialAutoRefresh ?? Boolean(options?.getText);
  let maskValuesEnabled = options?.initialMaskValues ?? true;
  let shouldScrollToBottomOnMount = Boolean(options?.startAtEnd);
  let lastSuccess = new Date().toLocaleString();
  const baseDelay = Math.max(1000, options?.refreshMs ?? 3000);
  let delay = baseDelay;
  const codeEl = E('code', {}, '') as HTMLElement;
  codeEl.tabIndex = 0;
  const contentEl = E(
    'pre',
    { class: 'fkp-partial-modal__content' },
    codeEl,
  ) as HTMLElement;
  const maskStatus = E('p', { role: 'status' }, '') as HTMLElement;
  const refreshStatus = E('p', { role: 'status' }, '') as HTMLElement;
  const copyStatus = E('div', { role: 'status' }, '') as HTMLElement;
  for (const status of [maskStatus, refreshStatus, copyStatus])
    status.setAttribute('aria-live', 'polite');

  const announce = (node: HTMLElement, message: string, failed = false) => {
    node.setAttribute('role', failed ? 'alert' : 'status');
    node.setAttribute('aria-live', failed ? 'assertive' : 'polite');
    node.textContent = message;
  };
  const updateText = (value: string) => {
    const stick =
      shouldScrollToBottomOnMount ||
      contentEl.scrollTop + contentEl.clientHeight >=
        contentEl.scrollHeight - 16;
    if (value !== currentText) {
      currentText = value;
      codeEl.textContent = value;
    }
    if (stick)
      requestAnimationFrame(() => {
        contentEl.scrollTop = contentEl.scrollHeight;
      });
  };
  const updateDisplayedText = () => {
    copyStatus.replaceChildren();
    try {
      const value =
        maskValuesEnabled && options?.maskText
          ? options.maskText(rawText)
          : rawText;
      if (typeof value !== 'string') throw new Error('Missing masked text');
      updateText(value);
      exportReady = true;
      announce(
        maskStatus,
        options?.showMaskValuesToggle
          ? maskValuesEnabled
            ? _('Known sensitive values hidden. Review before sharing.')
            : _(
                'Raw view — may contain passwords and other secrets. Copy and download include them.',
              )
          : '',
      );
    } catch {
      exportReady = false;
      updateText('');
      announce(
        maskStatus,
        _(
          'Masking failed. Safe copy and download are unavailable. Raw view may contain secrets.',
        ),
        true,
      );
    }
    copyButton.disabled = !exportReady;
    downloadButton.disabled = !exportReady;
  };
  const nativeModalClosed = () =>
    body.closest('#modal_overlay') !== null &&
    !document.body.classList.contains('modal-overlay-active');
  const active = () =>
    !closed && body.isConnected && !document.hidden && !nativeModalClosed();
  const stopTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const schedule = () => {
    stopTimer();
    if (options?.getText && autoRefreshEnabled && active() && !refreshInFlight)
      timer = setTimeout(() => {
        timer = undefined;
        void refreshText();
      }, delay);
  };
  const refreshText = async (force = false) => {
    if (!options?.getText || !active() || (!force && !autoRefreshEnabled))
      return;
    if (refreshInFlight) {
      if (force) pendingForcedRefresh = true;
      return;
    }
    stopTimer();
    refreshInFlight = true;
    refreshButton.disabled = true;
    const capturedSession = session;
    announce(
      refreshStatus,
      `${_('Refreshing…')} ${_('Last success:')} ${lastSuccess}`,
    );
    try {
      const value = await options.getText({
        maskValues: options.maskText ? false : maskValuesEnabled,
      });
      if (!active() || capturedSession !== session) return;
      const changed = value !== rawText;
      rawText = value ?? '';
      if (changed || !exportReady) updateDisplayedText();
      lastSuccess = new Date().toLocaleString();
      delay = changed ? baseDelay : Math.min(delay * 2, 30000);
      announce(refreshStatus, `${_('Last success:')} ${lastSuccess}`);
    } catch {
      if (!active() || capturedSession !== session) return;
      delay = Math.min(delay * 2, 30000);
      announce(
        refreshStatus,
        `${_('Refresh failed. The last successful text is retained. Retry with Refresh.')} ${_('Last success:')} ${lastSuccess}`,
        true,
      );
    } finally {
      refreshInFlight = false;
      refreshButton.disabled = false;
      if (
        active() &&
        (pendingForcedRefresh || (pendingResume && autoRefreshEnabled))
      ) {
        const forced = pendingForcedRefresh;
        pendingForcedRefresh = pendingResume = false;
        void refreshText(forced);
      } else schedule();
    }
  };
  const onVisibility = () => {
    session++;
    stopTimer();
    pendingForcedRefresh = pendingResume = false;
    if (document.hidden) {
      announce(
        refreshStatus,
        `${_('Auto refresh paused while this tab is hidden.')} ${_('Last success:')} ${lastSuccess}`,
      );
    } else if (autoRefreshEnabled) {
      if (refreshInFlight) pendingResume = true;
      else void refreshText();
    }
  };
  const destroy = () => {
    closed = true;
    session++;
    pendingForcedRefresh = pendingResume = false;
    stopTimer();
    observer.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
  };
  const downloadButton = renderButton({
    text: _('Download'),
    classNames: ['cbi-button-apply'],
    onClick: () => {
      if (exportReady) downloadAsTxt(currentText, name);
    },
  }) as HTMLButtonElement;
  const copyButton = renderButton({
    text: _('Copy'),
    classNames: ['cbi-button-apply'],
    onClick: async () => {
      if (!exportReady || copyInFlight) return;
      copyInFlight = true;
      copyButton.setAttribute('aria-busy', 'true');
      const feedback = document.createElement('div');
      copyStatus.replaceChildren(feedback);
      await copyToClipboard(`\`\`\`${name}\n${currentText}\n\`\`\``, feedback);
      copyInFlight = false;
      copyButton.removeAttribute('aria-busy');
    },
  }) as HTMLButtonElement;
  const refreshButton = renderButton({
    text: _('Refresh'),
    onClick: () => {
      void refreshText(true);
    },
  }) as HTMLButtonElement;
  const footer: HTMLElement[] = [downloadButton, copyButton];
  if (options?.getText) footer.push(refreshButton);
  footer.push(
    renderButton({
      text: _('Close'),
      classNames: ['cbi-button-remove'],
      onClick: () => {
        destroy();
        ui.hideModal();
      },
    }),
  );
  const toggle = (
    label: string,
    initial: boolean,
    changed: (value: boolean) => void,
  ) => {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'cbi-input-checkbox';
    input.checked = initial;
    input.addEventListener('change', () => changed(input.checked));
    return E('label', { class: 'fkp-partial-modal__checkbox' }, [
      input,
      E('span', { class: 'fkp-partial-modal__checkbox-text' }, label),
    ]) as HTMLElement;
  };
  if (options?.getText && options.showAutoRefreshToggle)
    footer.unshift(
      toggle(
        options.autoRefreshLabel ?? _('Auto refresh'),
        autoRefreshEnabled,
        (value) => {
          autoRefreshEnabled = value;
          session++;
          pendingForcedRefresh = pendingResume = false;
          stopTimer();
          if (value) {
            if (refreshInFlight) pendingResume = true;
            else void refreshText();
          } else
            announce(
              refreshStatus,
              `${_('Auto refresh paused.')} ${_('Last success:')} ${lastSuccess}`,
            );
        },
      ),
    );
  if ((options?.getText || options?.maskText) && options.showMaskValuesToggle)
    footer.unshift(
      toggle(
        options.maskValuesLabel ?? _('Hide values'),
        maskValuesEnabled,
        (value) => {
          maskValuesEnabled = value;
          if (options.maskText) updateDisplayedText();
          else {
            session++;
            exportReady = false;
            updateText('');
            copyButton.disabled = downloadButton.disabled = true;
            void refreshText(true);
          }
        },
      ),
    );
  const body = E('div', { class: 'fkp-partial-modal__body' }, [
    maskStatus,
    refreshStatus,
    contentEl,
    copyStatus,
    E('div', { class: 'fkp-partial-modal__footer' }, footer),
  ]) as HTMLElement;
  const observer = new MutationObserver(() => {
    if (mounted && nativeModalClosed()) {
      destroy();
      return;
    }
    if (!body.isConnected) {
      if (mounted) destroy();
      return;
    }
    if (!mounted) {
      mounted = true;
      if (shouldScrollToBottomOnMount) {
        requestAnimationFrame(() => {
          contentEl.scrollTop = contentEl.scrollHeight;
        });
        shouldScrollToBottomOnMount = false;
      }
      if (options?.getText) {
        document.addEventListener('visibilitychange', onVisibility);
        void refreshText();
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });
  updateDisplayedText();
  return body;
}
