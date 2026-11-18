import type { NextResponse } from '../../next/api';
import { navigateToRule } from '../../next/workflows';
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
  run.className = 'fkp-next-primary-action';
  const logs = text('button', 'Открыть журнал');
  logs.type = 'button';
  logs.onclick = () =>
    openLogs
      ? openLogs()
      : root.dispatchEvent(
          new CustomEvent('forkop:diagnostic-logs', { bubbles: true }),
        );
  const symptomActions = document.createElement('div');
  symptomActions.className = 'fkp-symptom-actions';
  symptomActions.append(run, logs);
  let generation = 0;
  const key = () =>
    JSON.stringify([symptom.value, domain.value, device.value, section.value]);
  function syncFields() {
    domainWrap.hidden = !['site', 'device'].includes(symptom.value);
    deviceWrap.hidden = symptom.value !== 'device';
    sectionWrap.hidden = symptom.value !== 'source';
  }
  function invalidate() {
    generation++;
    run.disabled = false;
    result.textContent = 'Параметры изменены — проверьте снова';
    syncFields();
  }
  symptom.onchange = invalidate;
  domain.oninput = invalidate;
  device.oninput = invalidate;
  section.onchange = invalidate;
  syncFields();
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
  const tspuCard = document.createElement('div');
  tspuCard.className = 'fkp-tspu-card';
  const tspuHeading = text('h4', 'Проверка блокировок ТСПУ (лимит 16–20 КБ)');
  const tspuHelp = text(
    'p',
    'Поэтапная проверка DNS, TCP, TLS ClientHello и загрузки 64 КБ позволяет выявить ограничение ТСПУ на 16–20 КБ, при котором ping и HTTP-заголовки проходят, но соединение обрывается при передаче данных.',
  );
  tspuHelp.className = 'fkp-next-help';
  const tspuDomain = document.createElement('input');
  tspuDomain.name = 'tspu_domain';
  tspuDomain.placeholder = 'youtube.com';
  const tspuPresets = document.createElement('div');
  tspuPresets.className = 'fkp-tspu-presets';
  for (const presetDomain of ['youtube.com', 'discord.com', 'cloudflare.com']) {
    const chip = text('button', presetDomain);
    chip.type = 'button';
    chip.className = 'fkp-tspu-preset';
    chip.dataset.tspuPreset = presetDomain;
    chip.onclick = () => {
      tspuDomain.value = presetDomain;
      tspuDomain.focus();
    };
    tspuPresets.append(chip);
  }
  const tspuCompare = document.createElement('select');
  tspuCompare.name = 'tspu_compare_section';
  const defaultCompareOpt = text('option', 'Без сравнения (только напрямую)');
  defaultCompareOpt.value = '';
  tspuCompare.append(defaultCompareOpt);
  const tspuSectionLabels = new Map<string, string>();
  const tspuConnectionSections: string[] = [];
  const tspuRun = text('button', 'Проверить блокировки ТСПУ (лимит 16–20 КБ)');
  tspuRun.type = 'button';
  tspuRun.className = 'fkp-next-primary-action';
  tspuRun.dataset.tspuRun = '';
  const tspuResult = text(
    'div',
    'Укажите домен (например, youtube.com) для проверки этапов DNS, TCP, TLS ClientHello и порога 16–20 КБ.',
  );
  tspuResult.className = 'fkp-tspu-result';
  tspuResult.setAttribute('role', 'status');
  tspuResult.setAttribute('aria-live', 'polite');
  tspuResult.dataset.tspuResult = '';

  const tspuVerdictCopy: Record<string, [string, string]> = {
    ok: [
      'Блокировка ТСПУ не обнаружена (передача 64 КБ успешна)',
      'Прямое соединение прошло все 4 этапа без обрыва на 16–20 КБ.',
    ],
    tspu_byte_cap_16kb: [
      'Обнаружена блокировка ТСПУ по объёму данных (лимит 16–20 КБ)',
      'DNS, TCP и TLS ClientHello проходят (поэтому ping и заголовки работают), но передача данных зависает и обрывается после 16–20 КБ. Направьте домен через прокси-туннель (VLESS Reality, Hysteria2, AmneziaWG или Cloudflare WARP).',
    ],
    tls_hello_blocked: [
      'Заблокировано рукопожатие TLS ClientHello (фильтрация SNI)',
      'TCP-соединение открывается, но пакет TLS ClientHello сбрасывается или блокируется ТСПУ. Направьте домен через зашифрованный прокси-туннель.',
    ],
    tls_cert_intercepted: [
      'Ошибка проверки сертификата или перехват TLS',
      'Проверьте системное время роутера; если время точное, HTTPS-соединение перехватывается. Направьте трафик через проверенный туннель.',
    ],
    clock_skew: [
      'Сбой проверки TLS из-за неверного системного времени роутера',
      'Синхронизируйте время по NTP в системе и повторите проверку.',
    ],
    tcp_blocked: [
      'Блокировка TCP-соединения к IP-адресу узла',
      'Соединение по порту 443 не устанавливается. Направьте домен и его IP-подсети через прокси-туннель.',
    ],
    dns_blocked: [
      'Не удалось разрешить домен через DNS',
      'Проверьте работу DNS и защищённого резолвера (DoH/DoT) в настройках Forkop.',
    ],
    dns_spoofed: [
      'Обнаружена подмена DNS-ответа (заглушка / приватный IP)',
      'Включите изолированный DNS через туннель или защищённый DoH/DoT резолвер.',
    ],
    http_restricted: [
      'Ограничение на уровне HTTP-ответа сервиса (403 / 451)',
      'ТСПУ не оборвал соединение, но сам веб-сервис ограничивает доступ с вашего IP-адреса. Выберите зарубежный выходной узел.',
    ],
    slow_link: [
      'Медленный ответ: порог 16–20 КБ пройден, но 64 КБ не уложились в тайм-аут',
      'Признаков жёсткого лимита ТСПУ 16–20 КБ нет; проверьте общую скорость канала.',
    ],
    uplink_down: [
      'Отсутствует выход в интернет с роутера',
      'Проверьте WAN-подключение роутера перед диагностикой блокировок.',
    ],
    probe_error: [
      'Не удалось выполнить проверку ТСПУ',
      'Проверьте корректность домена и наличие curl на роутере.',
    ],
  };

  const tspuStageTitle: Record<string, string> = {
    dns: '1. DNS',
    tcp: '2. TCP',
    tls: '3. TLS ClientHello',
    byte_cap: '4. Передача 64 КБ / лимит 16–20 КБ',
  };
  const tspuStageStatusText: Record<string, string> = {
    ok: 'Успешно',
    failed: 'Сбой / блок',
    warning: 'Внимание',
    skipped: 'Пропущено',
  };
  const routeActionableVerdicts = new Set([
    'tspu_byte_cap_16kb',
    'tls_hello_blocked',
    'tls_cert_intercepted',
    'tcp_blocked',
    'dns_spoofed',
    'http_restricted',
  ]);

  let tspuGen = 0;
  tspuRun.onclick = async () => {
    const rawDomain = tspuDomain.value.trim() || domain.value.trim();
    if (!rawDomain) {
      tspuResult.textContent =
        'Укажите домен для проверки блокировок ТСПУ (например, youtube.com).';
      return;
    }
    const curGen = ++tspuGen;
    const compareSec = tspuCompare.value.trim();
    tspuRun.disabled = true;
    tspuResult.textContent = `Проверяем этапы DNS → TCP → TLS ClientHello → 64 КБ для ${rawDomain}…`;
    try {
      const res = await read('tspu_classify', {
        domain: rawDomain,
        section: 'direct',
        ...(compareSec ? { compare_section: compareSec } : {}),
      });
      if (curGen !== tspuGen) return;
      if (!res.success) {
        tspuResult.textContent = `Проверка ТСПУ не выполнена: ${res.error || 'ошибка запроса'}.`;
        return;
      }
      const d = object(res.data);
      const verdictKey = String(d.verdict || 'probe_error');
      const [headline, advice] = tspuVerdictCopy[verdictKey] || [
        `Результат: ${verdictKey}`,
        'Сравните поведение через выбранное подключение.',
      ];

      const stageMap = new Map<string, Record<string, unknown>>();
      for (const rawStage of Array.isArray(d.stages) ? d.stages : []) {
        const st = object(rawStage);
        if (typeof st.stage === 'string') {
          stageMap.set(st.stage, st);
        }
      }

      const stageGrid = document.createElement('div');
      stageGrid.className = 'fkp-tspu-stages';
      for (const stageKey of ['dns', 'tcp', 'tls', 'byte_cap']) {
        const st = stageMap.get(stageKey) || { status: 'skipped' };
        const statusKey = String(st.status || 'skipped');
        const item = document.createElement('div');
        item.className = 'fkp-tspu-stage';
        item.dataset.tspuStage = stageKey;
        item.dataset.tspuStatus = statusKey;
        const titleNode = text('strong', tspuStageTitle[stageKey] || stageKey);
        const metaParts: string[] = [
          tspuStageStatusText[statusKey] || statusKey,
        ];
        if (typeof st.remote_ip === 'string' && st.remote_ip) {
          metaParts.push(st.remote_ip);
        }
        if (typeof st.bytes_read === 'number' && st.bytes_read > 0) {
          const kb = (st.bytes_read / 1024).toFixed(1);
          metaParts.push(`${kb} КБ`);
        }
        if (typeof st.http_code === 'number' && st.http_code > 0) {
          metaParts.push(`HTTP ${st.http_code}`);
        }
        if (typeof st.duration_ms === 'number' && st.duration_ms >= 0) {
          metaParts.push(`${st.duration_ms} мс`);
        }
        const detailNode = text('span', metaParts.join(' · '));
        item.append(titleNode, detailNode);
        stageGrid.append(item);
      }

      tspuResult.replaceChildren(
        text('strong', headline),
        text('p', advice),
        stageGrid,
      );

      if (d.comparison && typeof d.comparison === 'object') {
        const comp = object(d.comparison);
        const compSec = String(comp.section || compareSec);
        const compLabel = tspuSectionLabels.get(compSec) || compSec;
        const compText =
          comp.bypass_verified === true
            ? `Сравнение с маршрутом «${compLabel}»: обход подтверждён (передача 64 КБ прошла без блокировки).`
            : `Сравнение с маршрутом «${compLabel}»: статус ${String(comp.verdict || 'не подтверждён')}.`;
        const compNode = text('p', compText);
        compNode.className = 'fkp-tspu-comparison';
        tspuResult.append(compNode);
      }

      const actionsRow = document.createElement('div');
      actionsRow.className = 'fkp-tspu-actions';
      if (routeActionableVerdicts.has(verdictKey)) {
        const targetSec =
          compareSec ||
          (tspuConnectionSections.includes('main')
            ? 'main'
            : tspuConnectionSections[0]) ||
          '';
        const targetLabel = targetSec
          ? tspuSectionLabels.get(targetSec) || targetSec
          : '';
        const fixRouteBtn = text(
          'button',
          targetSec
            ? `Направить ${rawDomain} через «${targetLabel}»`
            : `Создать правило обхода для ${rawDomain}`,
        );
        fixRouteBtn.type = 'button';
        fixRouteBtn.className = 'fkp-next-primary-action';
        fixRouteBtn.dataset.tspuFixRoute = '';
        fixRouteBtn.onclick = () => {
          const ok = targetSec
            ? navigateToRule(root, {
                kind: 'site',
                section: targetSec,
                option: 'domain',
                site: rawDomain,
              })
            : navigateToRule(root, {
                kind: 'create',
                option: 'selector_proxy_links',
              });
          if (!ok) {
            tspuResult.append(
              text(
                'p',
                `Откройте раздел «Правила» и добавьте домен ${rawDomain} в условия подключения.`,
              ),
            );
          }
        };
        actionsRow.append(fixRouteBtn);
      }
      if (verdictKey === 'dns_blocked' || verdictKey === 'dns_spoofed') {
        const fixDnsBtn = text('button', 'Открыть настройки DNS');
        fixDnsBtn.type = 'button';
        fixDnsBtn.dataset.tspuFixDns = '';
        fixDnsBtn.onclick = () => {
          const map = root.closest('.cbi-map') || document;
          map
            .querySelector<HTMLElement>(
              '.cbi-tabmenu [data-tab="settings"] a, .cbi-tabmenu [data-tab="settings"] button',
            )
            ?.click();
          const dnsField =
            map.querySelector<HTMLElement>(
              '#widget\\.cbid\\.forkop\\.settings\\.dns_type',
            ) ||
            map.querySelector<HTMLElement>(
              '#cbi-forkop-settings-dns_type select',
            ) ||
            map.querySelector<HTMLElement>('#cbi-forkop-settings-dns_type');
          dnsField?.focus();
          dnsField?.scrollIntoView?.({ block: 'center' });
        };
        actionsRow.append(fixDnsBtn);
      }
      if (actionsRow.childNodes.length) {
        tspuResult.append(actionsRow);
      }
    } catch {
      if (curGen !== tspuGen) return;
      tspuResult.textContent =
        'Не удалось выполнить проверку ТСПУ. Проверьте соединение с роутером.';
    } finally {
      if (curGen === tspuGen) tspuRun.disabled = false;
    }
  };

  const tspuControls = document.createElement('div');
  tspuControls.className = 'fkp-tspu-controls';
  tspuControls.append(
    labelled('Домен для проверки ТСПУ', tspuDomain),
    tspuPresets,
    labelled('Сравнить с подключением (необязательно)', tspuCompare),
  );

  tspuCard.append(tspuHeading, tspuHelp, tspuControls, tspuRun, tspuResult);

  root.append(
    text('h3', 'Что не работает?'),
    labelled('Симптом', symptom),
    domainWrap,
    deviceWrap,
    sectionWrap,
    symptomActions,
    result,
    tspuCard,
  );
  void read('status')
    .then((response) => {
      if (!response.success) return;
      const rows = object(response.data).sections;
      for (const raw of Array.isArray(rows) ? rows : []) {
        const row = object(raw);
        if (typeof row.name !== 'string') continue;
        const labelText = String(row.label || row.name);
        tspuSectionLabels.set(row.name, labelText);
        const option = text('option', labelText);
        option.value = row.name;
        section.append(option);
        if (
          !row.action ||
          ['connection', 'proxy', 'outbound', 'vpn'].includes(
            String(row.action),
          )
        ) {
          tspuConnectionSections.push(row.name);
          const compOpt = text('option', labelText);
          compOpt.value = row.name;
          tspuCompare.append(compOpt);
        }
      }
    })
    .catch(() => {
      result.textContent =
        'Не удалось загрузить правила. Откройте диагностику повторно; проверки не запускались.';
    });
  return root;
}
