// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { renderExtendedPreview } from '../extendedPreview';
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});
it('discards older draft replies, renders only safe text and labels draft membership', async () => {
  let revision = 'one';
  const pending: ((v: unknown) => void)[] = [];
  vi.stubGlobal('fs', {
    exec: vi.fn(() => new Promise((resolve) => pending.push(resolve))),
  });
  const capture = () => ({
    draft: { section: {}, urltest: [], priority_group: [], priority_level: [] },
    revision,
  });
  const node = renderExtendedPreview('main', capture);
  document.body.append(node);
  const button = node.querySelector('button');
  expect(button).not.toBeNull();
  button!.click();
  revision = 'two';
  button!.click();
  const data = (id: string, name: string) => ({
    success: true,
    data: {
      requestId: id,
      capture: 'a'.repeat(64),
      candidates: [{ id: 'node_0', name }],
      groups: [
        {
          id: 'g1',
          kind: 'priority',
          name: 'Priority',
          count: 1,
          omitted: false,
          interrupt: true,
          levels: [
            {
              id: 'l1',
              name: 'Level 1',
              count: 1,
              empty: false,
              direct: false,
              members: ['node_0'],
              overlap: [],
              decisions: [
                {
                  member: 'node_0',
                  included: true,
                  reasons: ['exclude_miss'],
                },
              ],
            },
          ],
          fallbackOrder: ['l1'],
        },
      ],
    },
  });
  const calls = (fs.exec as ReturnType<typeof vi.fn>).mock.calls;
  const id = (i: number) => JSON.parse(calls[i][1][1]).requestId;
  pending[1]({
    stdout: JSON.stringify(data(id(1), '<img src=x onerror=alert(1)>')),
    code: 0,
  });
  await vi.waitFor(() => expect(node.textContent).toContain('Level 1'));
  pending[0]({ stdout: JSON.stringify(data(id(0), 'OLD')), code: 0 });
  await Promise.resolve();
  await Promise.resolve();
  expect(node.textContent).not.toContain('OLD');
  expect(node.querySelector('img')).toBeNull();
  expect(node.textContent).toContain('Черновик фильтров');
  expect(node.textContent).toContain('не проверялась');
  expect(node.textContent).toContain('Соединения прерываются');
  expect(node.textContent).toContain('Не совпадает с исключением');
});
it('never sends changed source drafts and gives an unavailable explanation', () => {
  const exec = vi.fn();
  vi.stubGlobal('fs', { exec });
  const node = renderExtendedPreview('main', () => ({
    unavailableReason: 'source_draft_changed',
    revision: 'x',
  }));
  document.body.append(node);
  node.querySelector('button')!.click();
  expect(exec).not.toHaveBeenCalled();
  expect(node.textContent).toContain('источники');
});
