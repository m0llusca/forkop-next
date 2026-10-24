import { nativeLuciMethods } from './nativeLuciMethods.js';

/** DOM/UCI boundaries for the captured native methods. No map lifecycle mock. */
export function nativeLuciHarness() {
  Object.defineProperty(String.prototype, 'format', {
    configurable: true,
    value: function (this: string, ...values: unknown[]) {
      let index = 0;
      return this.replace(/%[sd]/g, () => String(values[index++]));
    },
  });
  const instances = new WeakMap<HTMLElement, unknown>();
  function append(parent: HTMLElement, nodes: unknown) {
    for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
      if (node instanceof Node) parent.append(node);
      else if (node != null) parent.append(String(node));
    }
    return parent;
  }
  function E(
    tag: string,
    attrs: Record<string, unknown> = {},
    children?: unknown,
  ) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (typeof value === 'function')
        element.addEventListener(key, value as EventListener);
      else if (value != null) element.setAttribute(key, String(value));
    }
    return append(element, children);
  }
  const dom = {
    append,
    content: (element: HTMLElement, nodes: unknown) => {
      element.replaceChildren();
      if (nodes != null) append(element, nodes);
    },
    bindClassInstance: (element: HTMLElement, instance: unknown) =>
      instances.set(element, instance),
    findClassInstance: (element: HTMLElement) => instances.get(element),
    matches: (element: Element, selector: string) => element.matches(selector),
  };
  let selected = 0;
  const ui = {
    tabs: {
      isEmptyPane: (pane: HTMLElement) => !pane.firstChild,
      getActiveTabId: () => selected,
      setActiveTabId: (_pane: HTMLElement, index: number) => {
        selected = index;
      },
    },
    showModal: () => {},
    hideModal: () => {},
  };
  const UI = { prototype: { tabs: ui.tabs } };
  const methods = nativeLuciMethods(
    E,
    dom,
    {
      bind: (
        fn: (...args: never[]) => unknown,
        context: unknown,
        ...args: never[]
      ) => fn.bind(context, ...args),
    },
    ui,
    UI,
    (text: string) => text,
  );
  const tabs = Object.assign(ui.tabs, methods.tabs);
  return { ...methods, ui, dom, tabs };
}
