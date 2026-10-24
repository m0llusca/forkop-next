// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderSections } from '../../tabs/dashboard/partials/renderSections';
import { render } from '../../tabs/dashboard/render';
import type { Forkop } from '../../types';

beforeEach(() => {
  vi.stubGlobal('_', (s: string) => s);
  vi.stubGlobal(
    'E',
    (
      tag: string,
      attrs: Record<string, unknown> = {},
      children: unknown = [],
    ) => {
      const node = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs || {})) {
        if (typeof value === 'function')
          node.addEventListener(key, value as EventListener);
        else if (value !== undefined) node.setAttribute(key, String(value));
      }
      const add = (v: unknown) => {
        if (Array.isArray(v)) v.forEach(add);
        else if (v instanceof Node) node.append(v);
        else if (typeof v === 'string') node.append(document.createTextNode(v));
      };
      add(children);
      return node;
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

function fixture(overrides: Partial<Forkop.Outbound> = {}, switching?: string) {
  const choose = vi.fn();
  const copy = vi.fn();
  const outbound: Forkop.Outbound = {
    code: 'one',
    displayName: 'Example server',
    type: 'VLESS',
    selected: false,
    latency: 0,
    canCopyLink: true,
    ...overrides,
  };
  const section: Forkop.OutboundGroup = {
    code: 'main-out',
    sectionName: 'main',
    displayName: 'Main',
    withTagSelect: true,
    outbounds: [outbound],
  };
  const noop = () => {};
  const node = renderSections({
    loading: false,
    failed: false,
    section,
    onChooseOutbound: choose,
    onCopyOutbound: copy,
    onShowUrlTestInfo: noop,
    onShowPriorityInfo: noop,
    onTestLatency: noop,
    onUpdateSubscription: noop,
    latencyFetching: false,
    subscriptionUpdating: false,
    selectorSwitchingTag: switching,
  });
  return { node, choose, copy };
}

it('exposes a native selection button with its target and keeps copy independent', () => {
  const { node, choose, copy } = fixture();
  const select = node.querySelector<HTMLButtonElement>(
    '[data-outbound-select]',
  )!;
  expect(select).not.toBeNull();
  expect(select.tagName).toBe('BUTTON');
  expect(select.getAttribute('aria-label')).toContain('Example server');
  expect(select.disabled).toBe(false);
  select.click();
  expect(choose).toHaveBeenCalledExactlyOnceWith('main', 'main-out', 'one');
  node
    .querySelector<HTMLButtonElement>('[aria-label="Copy proxy link"]')!
    .click();
  expect(copy).toHaveBeenCalledOnce();
  expect(choose).toHaveBeenCalledOnce();
  expect(node.querySelector('button button')).toBeNull();
});

it.each([
  [{ selected: true }, undefined, 'Выбран'],
  [{ runtimeAvailable: false }, undefined, 'Недоступен'],
  [{}, 'one', 'Переключаем…'],
  [{}, 'other', 'Выбрать'],
] as const)(
  'renders disabled selection honestly for %o, %s',
  (outbound, switching, text) => {
    const { node, choose } = fixture(outbound, switching);
    const select = node.querySelector<HTMLButtonElement>(
      '[data-outbound-select]',
    )!;
    expect(select).not.toBeNull();
    expect(select.textContent).toBe(text);
    expect(select.disabled).toBe(true);
    select.click();
    expect(choose).not.toHaveBeenCalled();
  },
);

it('places outgoing servers before optional telemetry widgets', () => {
  const node = render();
  const content = node.querySelector('.fkp_dashboard-page__content')!;
  expect(content.firstElementChild?.id).toBe('dashboard-sections-grid');
  expect(node.querySelector('#dashboard-widget-traffic')).not.toBeNull();
});
