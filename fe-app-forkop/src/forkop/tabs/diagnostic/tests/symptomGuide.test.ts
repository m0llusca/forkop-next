// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { renderSymptomGuide } from '../symptomGuide';
import type { NextResponse } from '../../../next/api';
const tick = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};
afterEach(() => document.body.replaceChildren());
type Obj = Record<string, unknown>;
function mount(overrides: Record<string, NextResponse> = {}) {
  const calls: string[] = [];
  const read = async (action: string) => {
    calls.push(action);
    return (
      overrides[action] || {
        success: true,
        data:
          action === 'status'
            ? { sections: [{ name: 'main', label: 'VPN' }] }
            : action === 'diagnostic_service'
              ? { sing_box_process_running: 1, sing_box_ports_listening: 1 }
              : action === 'diagnostic_dns'
                ? { dns_status: true, bootstrap_dns_status: true }
                : action === 'route_explain'
                  ? { decision: { status: 'matched', section: 'main' } }
                  : { reachable: true },
      }
    );
  };
  const root = renderSymptomGuide(read);
  document.body.append(root);
  const choose = (value: string) => {
    const select = root.querySelector<HTMLSelectElement>(
      '[name=diagnostic_symptom]',
    )!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
  };
  const run = () => root.querySelector('button')!.click();
  const set = (name: string, value: string) => {
    const field = root.querySelector<HTMLInputElement>(`[name=${name}]`)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  };
  return { root, calls, choose, run, set };
}
it.each([
  ['all', 'роутер — служба и DNS'],
  ['service', 'роутер — служба'],
])(
  'captures the actual %s scope after subscription rules populate',
  async (scenario, scope) => {
    const { root, choose, run } = mount();
    await tick();
    expect(
      root.querySelector<HTMLSelectElement>('[name=symptom_section]')!.value,
    ).toBe('main');
    choose(scenario);
    run();
    await tick();
    const result = root.querySelector('[data-symptom-result]')!;
    expect(result.textContent).toContain(`Цель: ${scope}`);
    expect(result.textContent).not.toContain('Цель: main');
  },
);
it.each([
  [
    'diagnostic_dns',
    { dns_status: false, bootstrap_dns_status: true },
    'Проверка DNS завершилась ошибкой',
  ],
  ['probe', { reachable: false }, 'Соединение с сайтом с роутера не удалось'],
  [
    'route_explain',
    { decision: { status: 'blocked', section: 'main' } },
    'Сохранённое правило блокирует запрос',
  ],
  [
    'route_explain',
    { decision: { status: 'indeterminate', section: 'main' } },
    'Правило маршрута не подтверждено',
  ],
] as Array<[string, Obj, string]>)(
  'distinguishes observed %s outcomes and provides one next step',
  async (action, data, expected) => {
    const { root, choose, set, run } = mount({
      [action]: { success: true, data },
    });
    await tick();
    choose('site');
    set('symptom_domain', 'example.org');
    run();
    await tick();
    const result = root.querySelector('[data-symptom-result]')!;
    expect(result.querySelectorAll('strong')).toHaveLength(1);
    expect(result.textContent).toContain(expected);
    expect(result.textContent).toContain('Следующий шаг:');
    expect(result.textContent).toContain('example.org');
    expect(result.textContent).toContain('роутер');
  },
);
it('keeps unknown DNS evidence unconfirmed and avoids a misleading follow-on probe', async () => {
  const { root, calls, choose, set, run } = mount({
    diagnostic_dns: { success: true, data: {} },
  });
  await tick();
  choose('site');
  set('symptom_domain', 'example.org');
  run();
  await tick();
  expect(root.querySelector('[data-symptom-result]')!.textContent).toContain(
    'DNS не подтверждён',
  );
  expect(calls).not.toContain('probe');
});
it('distinguishes a source failure while retaining the last successful import time', async () => {
  const { root, calls, choose, run } = mount({
    source_evidence: {
      success: true,
      data: {
        section: 'main',
        sources: [
          {
            id: 'main-subscription-1',
            evidence: {
              status: 'failed',
              lastAttempt: 1792800000,
              lastSuccess: 1792700000,
              error: 'download_failed',
            },
          },
        ],
        connectivity_tested: false,
      },
    },
  });
  await tick();
  choose('source');
  run();
  await tick();
  expect(root.querySelector('[data-symptom-result]')!.textContent).toContain(
    'обновления источника завершилась ошибкой',
  );
  expect(root.querySelector('[data-symptom-result]')!.textContent).toContain(
    'Последний успешный импорт:',
  );
  expect(calls).not.toContain('probe');
  expect(calls).not.toContain('diagnostic_dns');
});
it('invalidates an older response and cannot expand an incomplete device scenario to all devices', async () => {
  let finish!: (response: NextResponse) => void;
  const root = renderSymptomGuide(async (action) =>
    action === 'status'
      ? { success: true, data: { sections: [] } }
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  document.body.append(root);
  await tick();
  const select = root.querySelector('select')!;
  select.value = 'device';
  select.dispatchEvent(new Event('change'));
  root.querySelector<HTMLInputElement>('[name=symptom_domain]')!.value =
    'example.org';
  root.querySelector('button')!.click();
  await tick();
  expect(finish).toBeUndefined();
  root.querySelector<HTMLInputElement>('[name=symptom_device]')!.value =
    '192.168.1.8';
  root.querySelector('button')!.click();
  await tick();
  select.value = 'source';
  select.dispatchEvent(new Event('change'));
  finish({ success: true, data: { sing_box_process_running: 0 } });
  await tick();
  expect(root.querySelector('[data-symptom-result]')!.textContent).toContain(
    'Параметры изменены',
  );
});
it('does not reuse the hidden device context after switching to a site scenario', async () => {
  const payloads: unknown[] = [];
  const root = renderSymptomGuide(async (action, payload) => {
    if (action === 'route_explain') payloads.push(payload);
    return {
      success: true,
      data:
        action === 'diagnostic_dns'
          ? { dns_status: true, bootstrap_dns_status: true }
          : action === 'diagnostic_service'
            ? { sing_box_process_running: 1, sing_box_ports_listening: 1 }
            : action === 'route_explain'
              ? { decision: { status: 'matched' } }
              : { sections: [], reachable: true },
    };
  });
  document.body.append(root);
  await tick();
  const select = root.querySelector('select')!;
  select.value = 'device';
  select.dispatchEvent(new Event('change'));
  root.querySelector<HTMLInputElement>('[name=symptom_domain]')!.value =
    'example.org';
  root.querySelector<HTMLInputElement>('[name=symptom_device]')!.value =
    '192.168.1.8';
  select.value = 'site';
  select.dispatchEvent(new Event('change'));
  root.querySelector('button')!.click();
  await tick();
  expect(payloads).toEqual([
    { domain: 'example.org', protocol: 'tcp', port: 443 },
  ]);
});
