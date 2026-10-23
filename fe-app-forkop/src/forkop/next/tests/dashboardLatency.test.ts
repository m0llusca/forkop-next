// @vitest-environment happy-dom
import { afterEach, it, expect, vi } from 'vitest';
import { renderSections } from '../../tabs/dashboard/partials/renderSections';
afterEach(() => vi.unstubAllGlobals());
it('renders measurement time as visible text for touch devices, not only a hover title', () => {
  vi.stubGlobal(
    'E',
    (
      tag: string,
      attrs: Record<string, unknown> = {},
      children: unknown = [],
    ) => {
      const e = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs || {})) {
        if (typeof value === 'function')
          e.addEventListener(
            key === 'click' ? 'click' : key,
            value as EventListener,
          );
        else if (value !== undefined) e.setAttribute(key, String(value));
      }
      const add = (v: unknown) => {
        if (Array.isArray(v)) v.forEach(add);
        else if (v instanceof Node) e.append(v);
        else if (typeof v === 'string') e.append(document.createTextNode(v));
      };
      add(children);
      return e;
    },
  );
  const noop = () => {};
  const rendered = renderSections({
    loading: false,
    failed: false,
    section: {
      code: 'main',
      sectionName: 'main',
      displayName: 'Home',
      withTagSelect: false,
      outbounds: [
        {
          code: 'one',
          displayName: 'One',
          latency: 54,
          latencyTestedAt: '2026-10-23T10:00:00Z',
          type: 'VLESS',
          selected: true,
        },
      ],
    },
    onTestLatency: noop,
    onChooseOutbound: noop,
    onCopyOutbound: noop,
    onShowUrlTestInfo: noop,
    onShowPriorityInfo: noop,
    onUpdateSubscription: noop,
    latencyFetching: false,
    subscriptionUpdating: false,
  });
  const timestamp = rendered.querySelector('time');
  expect(timestamp).not.toBeNull();
  expect(timestamp?.dateTime).toBe('2026-10-23T10:00:00Z');
  expect(timestamp?.textContent?.length).toBeGreaterThan(0);
});
