import type { NextResponse } from '../../next/api';
type Read = (
  action: string,
  payload?: Record<string, unknown>,
) => Promise<NextResponse>;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
export function renderSymptomGuide(read: Read, openLogs?: () => void) {
  const root = document.createElement('section');
  root.className = 'fkp-next-panel';
  const text = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    value: string,
  ) => {
    const node = document.createElement(tag);
    node.textContent = value;
    return node;
  };
  const labelled = <T extends HTMLElement>(label: string, node: T) => {
    const wrap = text('label', label);
    wrap.append(node);
    return wrap;
  };
  const symptom = document.createElement('select');
  symptom.name = 'diagnostic_symptom';
  for (const [value, label] of [
    ['all', 'Не работает всё'],
    ['site', 'Один сайт'],
    ['device', 'Одно устройство'],
    ['source', 'Не обновляется подписка'],
    ['service', 'Не запускается служба'],
  ]) {
    const option = text('option', label);
    option.value = value;
    symptom.append(option);
  }
  const domain = document.createElement('input');
  domain.name = 'symptom_domain';
  domain.placeholder = 'example.org';
  const device = document.createElement('input');
  device.name = 'symptom_device';
  const section = document.createElement('select');
  section.name = 'symptom_section';
  const domainWrap = labelled('Сайт для проверки HTTPS / TCP / 443', domain);
  const deviceWrap = labelled(
    'IP устройства (анализ правил, не проверка с устройства)',
    device,
  );
  const sectionWrap = labelled('Правило с подпиской', section);
  const result = text(
    'div',
    'Выберите симптом. Проверки запускаются только кнопкой ниже.',
  );
  result.setAttribute('role', 'status');
  result.dataset.symptomResult = '';
  const run = text('button', 'Проверить выбранный сценарий');
  run.type = 'button';
  const logs = text('button', 'Технические логи рядом');
  logs.type = 'button';
  logs.onclick = () =>
    openLogs
      ? openLogs()
      : root.dispatchEvent(
          new CustomEvent('forkop:diagnostic-logs', { bubbles: true }),
        );
  let generation = 0;
  const key = () =>
    JSON.stringify([symptom.value, domain.value, device.value, section.value]);
  function invalidate() {
    generation++;
    run.disabled = false;
    result.textContent = 'Параметры изменены — проверьте снова';
    domainWrap.hidden = !['site', 'device'].includes(symptom.value);
    deviceWrap.hidden = symptom.value !== 'device';
    sectionWrap.hidden = symptom.value !== 'source';
  }
  symptom.onchange = invalidate;
  domain.oninput = invalidate;
  device.oninput = invalidate;
  section.onchange = invalidate;
  invalidate();
  run.onclick = async () => {
    const captured = key(),
      id = ++generation,
      scenario = symptom.value;
    const target = ['site', 'device'].includes(scenario)
        ? domain.value.trim()
        : '',
      address = scenario === 'device' ? device.value.trim() : '',
      rule = scenario === 'source' ? section.value : '';
    if (
      (['site', 'device'].includes(scenario) && !target) ||
      (scenario === 'device' && !address) ||
      (scenario === 'source' && !rule)
    ) {
      result.textContent =
        'Заполните точный контекст: сайт, устройство или правило с подпиской.';
      return;
    }
    run.disabled = true;
    const at = new Date().toLocaleString();
    const context = `Сценарий: ${symptom.selectedOptions[0].textContent} · Устройство: ${address || 'не задано'} · Цель: ${target || rule || (scenario === 'service' ? 'роутер — служба' : 'роутер — служба и DNS')} · Источник проверки: роутер · ${at}`;
    const steps: string[] = [];
    const current = () => generation === id && key() === captured;
    const finish = (outcome: string, next: string) => {
      if (!current()) return;
      result.replaceChildren(
        text('strong', outcome),
        text('p', context),
        text('p', `Следующий шаг: ${next}`),
      );
      const details = document.createElement('details');
      details.append(
        text('summary', 'Технические результаты'),
        text('p', steps.join(' · ')),
      );
      result.append(details);
    };
    const check = async (action: string, payload = {}) => {
      const response = await read(action, payload);
      if (!current()) throw Error('obsolete');
      steps.push(
        `${action}: ${response.success ? 'ответ получен' : 'не выполнено'}`,
      );
      if (!response.success) throw Error('unavailable');
      return object(response.data);
    };
    result.textContent = `Проверяем выбранный сценарий… ${context}`;
    try {
      if (scenario === 'source') {
        const data = await check('source_evidence', { section: rule });
        const sources = Array.isArray(data.sources)
          ? data.sources.map(object)
          : [];
        for (const source of sources) {
          const evidence = object(source.evidence);
          const stamp = (value: unknown) =>
            typeof value === 'number' && Number.isFinite(value) && value >= 0
              ? new Date(value * 1000).toLocaleString()
              : 'неизвестно';
          steps.push(
            `Источник ${source.index || sources.indexOf(source) + 1}: последняя попытка: ${stamp(evidence.lastAttempt)}; Последний успешный импорт: ${stamp(evidence.lastSuccess)}`,
          );
        }
        const failed = sources.some(
          (source) => object(source.evidence).status === 'failed',
        );
        const known =
          sources.length > 0 &&
          sources.every(
            (source) => object(source.evidence).status === 'success',
          );
        finish(
          failed
            ? 'Последняя попытка обновления источника завершилась ошибкой'
            : known
              ? 'Импорт источников завершался успешно'
              : 'Результат обновления источника не подтверждён',
          failed
            ? 'Откройте источник в правиле и проверьте журнал обновления. Сеть этим чтением не проверялась.'
            : 'Проверьте обновление явно в правиле. История импорта не доказывает доступность серверов.',
        );
        return;
      }
      const service = await check('diagnostic_service');
      if (
        service.sing_box_process_running === 0 ||
        service.sing_box_installed === 0 ||
        service.sing_box_ports_listening === 0
      ) {
        finish(
          'Служба или её локальный слушатель не готовы',
          'Откройте логи запуска и состояние службы. Причина остановки пока не установлена.',
        );
        return;
      }
      if (scenario === 'service') {
        finish(
          service.sing_box_process_running === 1 &&
            service.sing_box_ports_listening === 1
            ? 'Процесс и локальный слушатель обнаружены'
            : 'Состояние службы не подтверждено',
          'Сверьте журнал запуска. Наличие процесса не подтверждает сетевую доступность.',
        );
        return;
      }
      const dns = await check('diagnostic_dns');
      if (
        dns.dns_status === 0 ||
        dns.dns_status === false ||
        dns.bootstrap_dns_status === 0 ||
        dns.bootstrap_dns_status === false
      ) {
        finish(
          'Проверка DNS завершилась ошибкой',
          'Проверьте DNS и Bootstrap DNS в настройках; это наблюдение, а не доказанная причина всех сбоев.',
        );
        return;
      }
      if (
        ![true, 1].includes(dns.dns_status as boolean | number) ||
        ![true, 1].includes(dns.bootstrap_dns_status as boolean | number)
      ) {
        finish(
          'DNS не подтверждён',
          'Повторите отдельную проверку DNS. Отсутствие данных не означает успешную проверку.',
        );
        return;
      }
      if (scenario === 'all') {
        finish(
          'Проверены служба и DNS; точная причина не подтверждена',
          'Выберите один сайт или устройство для проверки правил и отдельного сетевого запроса.',
        );
        return;
      }
      const route = await check('route_explain', {
        domain: target,
        ...(address ? { device: address } : {}),
        protocol: 'tcp',
        port: 443,
      });
      const decision = object(route.decision);
      if (
        decision.status === 'blocked' ||
        decision.status === 'indeterminate'
      ) {
        finish(
          decision.status === 'blocked'
            ? 'Сохранённое правило блокирует запрос'
            : 'Правило маршрута не подтверждено',
          'Откройте «Проверка маршрута» с тем же контекстом. Применённая конфигурация и трафик устройства не подтверждены.',
        );
        return;
      }
      const probe = await check('probe', { domain: target });
      finish(
        probe.reachable === false
          ? 'Соединение с сайтом с роутера не удалось'
          : probe.reachable === true
            ? 'Сетевой ответ с роутера получен'
            : 'Сетевой результат не подтверждён',
        probe.reachable === true
          ? 'Проверьте сайт на самом устройстве. Его Wi-Fi, DNS и доступ к аккаунту этим тестом не проверяются.'
          : 'Сравните другой маршрут отдельной проверкой. DNS, правило и сервер могут требовать дополнительных данных.',
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'obsolete') return;
      finish(
        'Не подтверждено: проверка не выполнена',
        'Проверьте связь с роутером и повторите сценарий; откройте технические логи.',
      );
    } finally {
      if (current()) run.disabled = false;
    }
  };
  root.append(
    text('h3', 'Что не работает?'),
    labelled('Симптом', symptom),
    domainWrap,
    deviceWrap,
    sectionWrap,
    run,
    result,
    logs,
  );
  void read('status')
    .then((response) => {
      if (!response.success) return;
      const rows = object(response.data).sections;
      for (const raw of Array.isArray(rows) ? rows : []) {
        const row = object(raw);
        if (typeof row.name !== 'string') continue;
        const option = text('option', String(row.label || row.name));
        option.value = row.name;
        section.append(option);
      }
    })
    .catch(() => {
      result.textContent =
        'Не удалось загрузить правила. Откройте диагностику повторно; проверки не запускались.';
    });
  return root;
}
