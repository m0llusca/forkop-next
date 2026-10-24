// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';

afterEach(() => document.body.replaceChildren());

it('reads cloned native modal options, including detached parent drafts, without rebasing on cancel', () => {
  const source = readFileSync(
    '../luci-app-forkop/htdocs/luci-static/resources/view/forkop/section.js',
    'utf8',
  );
  const block = source.match(
    /\/\/ Extended preview native snapshot begin[\s\S]*?\/\/ Extended preview native snapshot end/,
  )![0];
  const render = source.match(
    /o\.renderWidget = function \(sectionId\) \{[\s\S]*?\n {2}\};/,
  )![0];
  const saved = ['socks5://demo.example:1080#Main'];
  const row = {
    '.name': 'main',
    '.type': 'section',
    action: 'connection',
    selector_proxy_links: saved,
  };
  const uci = {
    get: () => row,
    sections: (_p: string, kind: string) => (kind === 'section' ? [row] : []),
  };
  const api = new Function(
    'uci',
    'document',
    'UCI_PACKAGE',
    'sectionGroupSourceOptions',
    'outboundNameSourceOptions',
    'currentSectionGroupValues',
    'getChildItemIds',
    'urlTestSettingsKeys',
    'priorityGroupSettingsKeys',
    'priorityLevelSettingsKeys',
    block +
      `
    function mountExtendedPreview(sectionId) { return () => captureExtendedPreviewDraft(sectionId); }
    let o = {}; ${render}
    return {rememberExtendedPreviewContext, captureExtendedPreviewDraft, render: o.renderWidget};
  `,
  )(
    uci,
    document,
    'forkop',
    new Map(),
    new Map(),
    () => [],
    () => [],
    () => [],
    () => [],
    () => [],
  );

  // LuCI GridSection.cloneOptions excludes map/section; the modal gets a separate
  // CBIMap. Map.lookupOption finds data-field only below that map's own root.
  class NativeOption {
    constructor(
      readonly root: HTMLElement,
      readonly key: string,
    ) {}
    cbid() {
      return `cbid.forkop.main.${this.key}`;
    }
    formvalue() {
      const widget = this.root.querySelector(`[id="${this.cbid()}"]`)!;
      if (widget.matches('select')) return (widget as HTMLSelectElement).value;
      const values = Array.from(
        widget.querySelectorAll<HTMLInputElement>(
          '.item > input[type="hidden"]',
        ),
      ).map((node) => node.value);
      const pending = widget.querySelector<HTMLInputElement>(
        '.add-item > input[type="text"]',
      );
      if (
        pending?.value.trim() &&
        !pending.classList.contains('cbi-input-invalid')
      )
        values.push(pending.value);
      return values;
    }
  }
  const instances = new WeakMap<Element, NativeOption>();
  const mapFor = (root: HTMLElement) => ({
    root,
    lookupOption(name: string, sid: string) {
      const id = `cbid.forkop.${sid}.${name}`;
      const field = this.root.querySelector(`[data-field="${id}"]`);
      const inst = field ? instances.get(field) : null;
      return inst instanceof NativeOption ? [inst, sid] : null;
    },
  });
  const tableRoot = document.createElement('div');
  document.body.append(tableRoot);
  api.rememberExtendedPreviewContext({ map: mapFor(tableRoot) });
  const makeModal = () => {
    const root = document.createElement('div');
    root.className = 'cbi-map';
    const field = document.createElement('div');
    field.dataset.field = 'cbid.forkop.main.selector_proxy_links';
    const widget = document.createElement('div');
    widget.id = field.dataset.field;
    const item = document.createElement('div');
    item.className = 'item';
    const input = document.createElement('input');
    input.type = 'hidden';
    input.value = saved[0];
    item.append(input);
    const add = document.createElement('div');
    add.className = 'add-item';
    const pending = document.createElement('input');
    pending.type = 'text';
    add.append(pending);
    widget.append(item, add);
    field.append(widget);
    root.append(field);
    instances.set(field, new NativeOption(root, 'selector_proxy_links'));
    const filterField = document.createElement('div');
    filterField.dataset.field = 'cbid.forkop.main.dashboard_filter_mode';
    const mode = document.createElement('select');
    mode.id = filterField.dataset.field;
    for (const value of ['disabled', 'include']) {
      const option = document.createElement('option');
      option.value = value;
      mode.append(option);
    }
    filterField.append(mode);
    root.append(filterField);
    instances.set(filterField, new NativeOption(root, 'dashboard_filter_mode'));
    document.body.append(root);
    const section = { map: mapFor(root) };
    const capture = api.render.call({ section, map: section.map }, 'main');
    return { root, widget, item, pending, mode, capture };
  };
  const modal = makeModal();
  expect(modal.capture().unavailableReason).toBeUndefined();
  modal.pending.value = 'socks5://new.example:1080#New';
  expect(modal.capture().unavailableReason).toBe('source_draft_changed');
  modal.pending.value = '';
  const added = modal.item.cloneNode(true) as HTMLElement;
  added.querySelector('input')!.value = 'socks5://new.example:1080#New';
  modal.widget.prepend(added);
  expect(modal.capture().unavailableReason).toBe('source_draft_changed');
  modal.root.remove(); // Nested child UI detaches the parent but keeps its map.
  expect(api.captureExtendedPreviewDraft('main').unavailableReason).toBe(
    'source_draft_changed',
  );
  added.remove();
  modal.pending.value = 'socks5://pending.example:1080#Pending';
  expect(api.captureExtendedPreviewDraft('main').unavailableReason).toBe(
    'source_draft_changed',
  );
  modal.pending.value = '';
  modal.mode.value = 'include';
  expect(
    api.captureExtendedPreviewDraft('main').draft.section.dashboard_filter_mode,
  ).toBe('include');
  document.body.append(modal.root); // Cancel child: same parent context remains.
  expect(modal.capture().draft.section.dashboard_filter_mode).toBe('include');
  modal.root.remove(); // Cancel parent: reopen from unchanged saved sources.
  const reopened = makeModal();
  expect(reopened.capture().unavailableReason).toBeUndefined();
  expect(reopened.capture().draft.section.dashboard_filter_mode).toBe(
    'disabled',
  );
});
