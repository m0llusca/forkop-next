import { nextRequest } from '../next/api';
import {
  renderAdvancedPanel,
  type Request,
  type ToolArea,
} from '../next/advanced';

/** Native panes remain the activation authority; navigation never reconstructs tools. */
export function renderWorkspaceTools(
  area: Exclude<ToolArea, 'all'>,
  request: Request = nextRequest,
): HTMLElement {
  const root = document.createElement('section');
  root.className = 'fkp-workspace-tools';
  root.dataset.toolsArea = area;
  const placeholder = document.createElement('p');
  placeholder.textContent = 'Инструменты загрузятся при открытии раздела.';
  root.append(placeholder);
  let mounted = false;
  let disposed = false;
  let wasConnected = root.isConnected;
  function dispose() {
    disposed = true;
    observer.disconnect();
    root.removeEventListener('forkop:dispose-tools', dispose);
  }
  function check() {
    if (disposed) return;
    if (wasConnected && !root.isConnected) return dispose();
    wasConnected ||= root.isConnected;
    if (
      mounted ||
      !root.isConnected ||
      root.closest('[data-tab]')?.getAttribute('data-tab-active') !== 'true'
    )
      return;
    mounted = true;
    root.replaceChildren(renderAdvancedPanel(request, undefined, false, area));
    observer.disconnect();
  }
  const observer = new MutationObserver(check);
  observer.observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-tab-active'],
  });
  root.addEventListener('forkop:dispose-tools', dispose);
  queueMicrotask(check);
  return root;
}

/** Call before native renderContents clears a map, even before its first insertion. */
export function disposeWorkspaceTools(root: HTMLElement): void {
  root
    .querySelectorAll('.fkp-workspace-tools')
    .forEach((host) => host.dispatchEvent(new Event('forkop:dispose-tools')));
}
