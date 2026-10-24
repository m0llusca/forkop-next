// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import {
  renderSections,
  replaceSectionsPreservingSearch,
} from '../../tabs/dashboard/partials/renderSections';
import { renderSourceEvidence } from '../../tabs/dashboard/partials/sourceEvidence';

afterEach(() => vi.unstubAllGlobals());

it('names missing source history and preserves successful import evidence beside a failed attempt', () => {
  const missing = renderSourceEvidence('main', 1);
  expect(missing.textContent).toContain('Последняя удача: неизвестно');
  expect(missing.textContent).toContain('Последняя попытка: неизвестно');
  const node = renderSourceEvidence('main', 1, [
    {
      id: 'main-subscription-1',
      index: 1,
      usedBy: ['main'],
      evidence: {
        status: 'failed',
        lastAttempt: 200,
        lastSuccess: 100,
        error: 'download_or_import_failed',
        import: {
          added: 3,
          accepted: 5,
          skipped: 2,
          duplicates: null,
          unsupported: null,
        },
      },
    },
  ]);
  expect(node.textContent).toContain('Добавлено: 3');
  expect(node.textContent).toContain('Пропущено: 2');
  expect(node.textContent).toContain('Дубликаты: неизвестно');
  expect(node.textContent).toContain('Не поддержано: неизвестно');
  expect(node.textContent).toContain('Используется: main');
  expect(node.textContent).toContain('Последний рабочий набор сохранён');
  expect(node.textContent).toContain('Назначить трафик');
});

it('searches 200 nodes locally by name, country and type while pinning the selection', () => {
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
      const add = (value: unknown) => {
        if (Array.isArray(value)) value.forEach(add);
        else if (value instanceof Node) node.append(value);
        else if (typeof value === 'string')
          node.append(document.createTextNode(value));
      };
      add(children);
      return node;
    },
  );
  const action = vi.fn();
  const section = {
    code: 'large-out',
    sectionName: 'large',
    displayName: 'Large',
    withTagSelect: true,
    outbounds: Array.from({ length: 200 }, (_, i) => ({
      code: `node-${i}`,
      displayName: `Node ${i}`,
      country: i === 199 ? 'JP' : 'FR',
      type: i === 199 ? 'trojan' : 'vless',
      selected: i === 0,
      latency: 0,
    })),
  };
  const before = JSON.stringify(section);
  const render = () =>
    renderSections({
      section,
      loading: false,
      failed: false,
      latencyFetching: false,
      subscriptionUpdating: false,
      onChooseOutbound: action,
      onCopyOutbound: action,
      onShowUrlTestInfo: action,
      onShowPriorityInfo: action,
      onTestLatency: action,
      onUpdateSubscription: action,
    });
  const root = render();
  const container = document.createElement('div');
  document.body.append(container);
  container.append(root);
  const search = root.querySelector<HTMLInputElement>('input[type="search"]');
  expect(search).not.toBeNull();
  for (const query of ['Node 199', 'JP', 'trojan']) {
    search!.value = query;
    search!.dispatchEvent(new Event('input'));
    const visible = [
      ...root.querySelectorAll<HTMLElement>('[data-outbound-row]'),
    ].filter((n) => !n.hidden);
    expect(visible.map((n) => n.dataset.outboundRow)).toEqual([
      'node-0',
      'node-199',
    ]);
    expect(root.querySelector('[role="status"]')?.textContent).toContain(
      '1 из 200',
    );
    expect(root.textContent).toContain('Выбранный узел закреплён');
  }
  expect(action).not.toHaveBeenCalled();
  expect(JSON.stringify(section)).toBe(before);
  expect(
    render().querySelector<HTMLInputElement>('input[type="search"]')?.value,
  ).toBe('trojan');
  search!.focus();
  search!.setSelectionRange(2, 3);
  replaceSectionsPreservingSearch(container, [render()]);
  expect(document.activeElement).toBe(
    container.querySelector('input[type="search"]'),
  );
  expect((document.activeElement as HTMLInputElement).selectionStart).toBe(2);
  container.remove();
  search!.value = '';
  search!.dispatchEvent(new Event('input'));
  expect(
    [...root.querySelectorAll<HTMLElement>('[data-outbound-row]')].filter(
      (n) => !n.hidden,
    ),
  ).toHaveLength(200);
});
