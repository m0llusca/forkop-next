// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { renderAdvancedPanel, type Request } from '../advanced';
import { renderCompatibilityPanel } from '../compatibility';
const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
afterEach(() => document.body.replaceChildren());
it('retries compatibility route reads from the settings refresh while preserving entered JSON', async () => {
  let fail = true;
  const request: Request = async (action) =>
    action === 'status'
      ? fail
        ? { success: false, error: 'offline' }
        : {
            success: true,
            data: {
              versions: {},
              sections: [{ name: 'vpn', label: 'Recovered' }],
            },
          }
      : { success: true, data: { items: [] } };
  const root = renderAdvancedPanel(request, undefined, false, 'settings');
  document.body.append(root);
  await tick();
  const json = root.querySelector<HTMLTextAreaElement>(
    '.fkp-next-compatibility textarea',
  )!;
  json.value = '{"keep":"draft"}';
  fail = false;
  [...root.querySelectorAll('button')]
    .find((b) => b.textContent === 'Обновить данные')!
    .click();
  await tick();
  expect(
    root.querySelector('.fkp-next-compatibility select')?.textContent,
  ).toContain('Recovered');
  expect(json.value).toBe('{"keep":"draft"}');
});
it('ignores an older compatibility route read after a successful retry', async () => {
  let finish!: (value: Awaited<ReturnType<Request>>) => void;
  const initial: Request = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const fresh: Request = async () => ({
    success: true,
    data: { sections: [{ name: 'new', label: 'Fresh' }] },
  });
  const root = renderCompatibilityPanel(fresh, initial);
  document.body.append(root);
  root.dispatchEvent(new Event('forkop:refresh-tools'));
  await tick();
  finish({
    success: true,
    data: { sections: [{ name: 'old', label: 'Obsolete' }] },
  });
  await tick();
  expect(root.querySelector('select')?.textContent).toContain('Fresh');
  expect(root.querySelector('select')?.textContent).not.toContain('Obsolete');
});
