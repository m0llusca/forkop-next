import { renderDeviceProfileTools } from './tools';
import { renderCompatibilityPanel } from './compatibility';
import { nextRequest, type NextResponse } from './api';
type Obj = Record<string, unknown>;
export type Request = (action: string, payload?: Obj) => Promise<NextResponse>;
export type ToolArea = 'all' | 'rules' | 'diagnostics' | 'settings' | 'devices';
const object = (v: unknown): Obj =>
  v && typeof v === 'object' ? (v as Obj) : {};
const items = (v: unknown): Obj[] =>
  Array.isArray(object(v).items) ? (object(v).items as Obj[]) : [];
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = '',
  className = '',
) {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}
function input(name: string, label: string, value = '') {
  const wrap = el('label', label);
  const node = el('input');
  node.name = name;
  node.value = value;
  wrap.append(node);
  return { wrap, node };
}
function select(label: string, choices: [string, string][]) {
  const wrap = el('label', label);
  const node = el('select');
  for (const [value, text] of choices) {
    const option = el('option', text);
    option.value = value;
    node.append(option);
  }
  wrap.append(node);
  return { wrap, node };
}
export type ConnectionLoader = () => Promise<{
  success: boolean;
  data?: Array<{
    sectionName?: string;
    code?: string;
    displayName: string;
    outbounds: Array<{
      code?: string;
      displayName: string;
      selected: boolean;
      latency: number;
      latencyTestedAt?: string;
    }>;
  }>;
}>;
export function renderAdvancedPanel(
  request: Request = nextRequest,
  loadConnections?: ConnectionLoader,
  lazy = false,
  area: ToolArea = 'all',
): HTMLElement {
  const includes = (part: ToolArea) => area === 'all' || area === part;
  // Share one read per refresh wave, never across explicit refreshes or actions.
  function sharedReads(): Request {
    const reads = new Map<string, Promise<NextResponse>>();
    return (action, payload = {}) => {
      if (action !== 'status' && action !== 'profile_list')
        return request(action, payload);
      let pending = reads.get(action);
      if (!pending) {
        pending = request(action, payload);
        reads.set(action, pending);
      }
      return pending;
    };
  }
  const initialRequest = sharedReads();
  const root = el(
    'section',
    '',
    lazy ? 'fkp-next-advanced-content' : 'fkp-next',
  );
  root.dataset.mode = lazy || area !== 'all' ? 'detailed' : 'simple';
  if (area !== 'all') root.dataset.area = area;
  const header = el('header');
  const title = el('div');
  title.append(
    el('h2', 'Forkop Next'),
    el('p', 'Подключения, правила и восстановление — под вашим контролем.'),
  );
  const mode = el('button', 'Подробный режим');
  mode.type = 'button';
  mode.onclick = () => {
    const detailed = root.dataset.mode === 'simple';
    root.dataset.mode = detailed ? 'detailed' : 'simple';
    mode.textContent = detailed ? 'Простой режим' : 'Подробный режим';
    root
      .querySelectorAll<HTMLElement>('[data-detail]')
      .forEach((node) => (node.hidden = !detailed));
  };
  const theme = select('Тема', [
    ['auto', 'Как в LuCI'],
    ['light', 'Светлая'],
    ['dark', 'Тёмная'],
  ]);
  theme.node.onchange = () => (root.dataset.theme = theme.node.value);
  header.append(title, mode, theme.wrap);
  if (lazy || area !== 'all') header.replaceChildren();
  root.append(header);
  const message = el('p', '', 'fkp-next-notice');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  const status = el('p', 'Загружаем состояние…', 'fkp-next-status');
  root.append(status, message);
  const summary = el('p', '', 'fkp-next-summary');
  root.append(summary);
  async function refreshConnections() {
    if (!loadConnections) return;
    try {
      const r = await loadConnections();
      if (!r.success) {
        summary.textContent =
          'Подключения недоступны. Проверьте состояние сервиса на вкладке Dashboard.';
        return;
      }
      summary.replaceChildren();
      for (const group of r.data || []) {
        const node = group.outbounds.find((o) => o.selected);
        if (node)
          summary.append(
            el(
              'span',
              `${group.displayName}: ${node.displayName} · ${node.latency > 0 ? `${node.latency} мс` : 'задержка не измерена'}${node.latencyTestedAt ? ' · проверено ' + new Date(node.latencyTestedAt).toLocaleString() : ''}`,
            ),
          );
      }
    } catch {
      summary.textContent = 'Не удалось обновить выбранные серверы.';
    }
  }
  const content = el('div', '', 'fkp-next-content');
  root.append(content);
  let digest = '';
  let sections: [string, string][] = [];
  const connectionLabel = (name: unknown, fallback = '—') =>
    sections.find(([id]) => id === name)?.[1] || String(name || fallback);
  let previewName = '';
  let previewDigest = '';
  let previewProfileDigest = '';
  let previewGeneration = 0;
  function invalidatePreview() {
    previewGeneration++;
    previewName = '';
    previewDigest = '';
    previewProfileDigest = '';
    apply.disabled = true;
  }
  const sectionSelects: HTMLSelectElement[] = [];
  function connection(label = 'Подключение') {
    const s = select(label, sections);
    sectionSelects.push(s.node);
    return s;
  }
  function panel(title: string, help: string, part: ToolArea) {
    const p = el('section', '', 'fkp-next-panel');
    if (!lazy || area === 'all') p.append(el('h3', title));
    p.append(el('p', help, 'fkp-next-help'));
    if (!includes(part)) return p;
    if (lazy) {
      const details = el('details', '', 'fkp-next-disclosure');
      details.append(el('summary', title));
      let mounted = false;
      details.addEventListener('toggle', () => {
        if (!details.open || mounted) return;
        mounted = true;
        details.append(p);
        void (
          title === 'Профили и восстановление'
            ? refreshProfiles(request)
            : title === 'Временные правила'
              ? refreshTemporary()
              : title === 'Smart Detect'
                ? refreshRecommendations()
                : Promise.resolve()
        ).catch(() => {
          message.textContent =
            'Не удалось загрузить данные. Нажмите «Обновить данные».';
        });
      });
      content.append(details);
    } else content.append(p);
    return p;
  }
  async function invoke(
    action: string,
    payload: Obj = {},
    output?: HTMLElement,
  ) {
    message.textContent = 'Выполняем…';
    root.setAttribute('aria-busy', 'true');
    try {
      const result = await request(action, payload);
      message.textContent = result.success
        ? 'Готово'
        : `Не удалось выполнить действие: ${result.error || 'неизвестная ошибка'}`;
      if (output) {
        const data = object(result.data);
        const changed = Array.isArray(data.changed) ? data.changed : null;
        const summaries: Record<string, string> = {
          profile_diff: changed
            ? changed.length
              ? `Изменённых параметров: ${changed.length}. Значения скрыты.`
              : 'Профиль совпадает с текущей конфигурацией.'
            : 'Список изменений не получен. Проверьте технические подробности.',
          profile_apply: 'Профиль применён.',
          profile_save: `Профиль «${data.name || payload.name || ''}» сохранён.`,
          rollback: 'Предыдущая конфигурация восстановлена.',
          recover: 'Прерванное применение восстановлено.',
        };
        output.replaceChildren(
          el(
            'strong',
            result.success
              ? summaries[action] || 'Действие выполнено.'
              : `Действие не выполнено: ${result.error || 'неизвестная ошибка'}`,
          ),
        );
        const details = el('details');
        details.append(el('summary', 'Технические подробности'));
        if (result.success && action === 'profile_diff' && changed?.length) {
          const list = el('ul');
          for (const key of changed) list.append(el('li', String(key)));
          details.append(list);
        }
        details.append(
          el(
            'pre',
            JSON.stringify(result.data ?? { error: result.error }, null, 2),
          ),
        );
        output.append(details);
      }
      return result;
    } catch {
      message.textContent = 'Нет связи с роутером. Повторите действие.';
      return { success: false, error: 'connection_failed' };
    } finally {
      root.setAttribute('aria-busy', 'false');
    }
  }
  function action(text: string, handler: () => Promise<unknown>) {
    const b = el('button', text);
    b.type = 'button';
    b.onclick = async () => {
      b.disabled = true;
      try {
        await handler();
      } finally {
        b.disabled =
          b === apply && (!previewName || previewName !== profile.node.value);
      }
    };
    return b;
  }
  const route = panel(
    'Почему сайт идёт так?',
    'Проверка правил объясняет маршрут. Доступность проверяется отдельным действием.',
    'diagnostics',
  );
  const domain = input('domain', 'Домен');
  domain.node.placeholder = 'example.org';
  const device = input('device', 'IP устройства (необязательно)');
  const routeResult = el('div', '', 'fkp-next-result');
  let routeGeneration = 0;
  let probeGeneration = 0;
  const routeKey = () => JSON.stringify([domain.node.value, device.node.value]);
  const probeKey = () =>
    JSON.stringify([domain.node.value, probeSection.node.value]);
  routeResult.setAttribute('aria-live', 'polite');
  route.append(
    domain.wrap,
    device.wrap,
    action('Объяснить маршрут', async () => {
      const generation = ++routeGeneration;
      const key = routeKey();
      const capturedDomain = domain.node.value.trim();
      const capturedDevice = device.node.value.trim();
      const capturedAt = new Date().toLocaleString();
      const r = await invoke('route_explain', {
        domain: domain.node.value.trim(),
        device: device.node.value.trim(),
        port: 443,
        protocol: 'tcp',
      });
      if (generation !== routeGeneration || key !== routeKey()) return;
      routeResult.replaceChildren();
      if (!r.success) return;
      const data = object(r.data);
      const decision = object(data.decision);
      const decisionLabels: Record<string, string> = {
        matched: 'Правило найдено',
        direct: 'Напрямую',
        blocked: 'Заблокировано',
        indeterminate: 'Маршрут требует уточнения',
      };
      routeResult.append(
        el(
          'strong',
          `${decisionLabels[String(decision.status)] || 'Не определено'} → ${connectionLabel(decision.section || decision.outbound)}`,
        ),
        el('p', 'Доступность сайта не проверялась'),
        el(
          'p',
          `Цель: ${capturedDomain} · Устройство: ${capturedDevice || 'не указано'} · Источник правил: роутер · ${capturedAt}`,
        ),
      );
      const trace = el('ol');
      trace.dataset.detail = 'true';
      trace.hidden = root.dataset.mode !== 'detailed';
      for (const step of Array.isArray(data.trace) ? data.trace : []) {
        const row = object(step);
        trace.append(
          el(
            'li',
            `${connectionLabel(row.section, '')}: ${row.reason || row.match || ''}`,
          ),
        );
      }
      routeResult.append(trace);
    }),
    routeResult,
  );
  const probeSection = select('Маршрут проверки', [
    ['', 'Текущий маршрут роутера'],
  ]);
  const probeResult = el('p', '', 'fkp-next-result');
  probeResult.setAttribute('aria-live', 'polite');
  const probeAction = action('Проверить доступность', async () => {
    const generation = ++probeGeneration;
    const key = probeKey();
    const target = domain.node.value.trim();
    const route =
      probeSection.node.selectedOptions[0]?.textContent ||
      'Текущий маршрут роутера';
    const capturedAt = new Date().toLocaleString();
    const context = `Цель: ${target} · Подключение: ${route} · Источник: с роутера, не с клиентского устройства · ${capturedAt}`;
    probeResult.textContent = `Проверяем… ${context}`;
    const payload: Obj = { domain: target };
    if (probeSection.node.value) payload.section = probeSection.node.value;
    const r = await invoke('probe', payload);
    if (generation !== probeGeneration || key !== probeKey()) return;
    if (!r.success) {
      probeResult.textContent = `Проверка не выполнена: ${r.error}. ${context}`;
      return;
    }
    const d = object(r.data);
    probeResult.textContent = `${d.reachable === true ? 'Сайт доступен' : d.reachable === false ? 'Сайт недоступен' : 'Доступность неизвестна'} · HTTP ${d.http_status || '—'} · ${d.duration_ms ?? '—'} мс. ${context}. Проверен сетевой доступ с роутера; вход в сервис не проверяется.`;
  });
  function invalidateProbe() {
    probeGeneration++;
    probeAction.disabled = false;
    probeResult.textContent = 'Параметры изменены — проверьте снова';
  }
  function invalidateRoute() {
    routeGeneration++;
    routeResult.textContent = 'Параметры изменены — проверьте снова';
  }
  domain.node.oninput = () => {
    invalidateRoute();
    invalidateProbe();
  };
  device.node.oninput = invalidateRoute;
  probeSection.node.onchange = invalidateProbe;
  route.append(probeSection.wrap, probeAction, probeResult);
  const profiles = panel(
    'Профили и восстановление',
    'Сначала сравните профиль. При применении сохраняется предыдущая рабочая конфигурация.',
    'settings',
  );
  const profile = select('Сохранённый профиль', []);
  const profileName = input('profile_name', 'Название нового профиля');
  const profileResult = el('div', '', 'fkp-next-result');
  profileResult.setAttribute('aria-live', 'polite');
  const apply = action('Применить профиль', async () => {
    if (
      previewName !== profile.node.value ||
      !previewDigest ||
      !previewProfileDigest
    )
      return;
    await invoke(
      'profile_apply',
      {
        name: previewName,
        expected: previewDigest,
        expected_profile: previewProfileDigest,
      },
      profileResult,
    );
    invalidatePreview();
    await refreshStatus();
    apply.disabled = true;
  });
  apply.disabled = true;
  profile.node.onchange = () => {
    invalidatePreview();
  };
  profiles.append(
    profile.wrap,
    action('Сравнить профиль', async () => {
      invalidatePreview();
      const generation = previewGeneration;
      const requestedName = profile.node.value;
      const r = await invoke(
        'profile_diff',
        { name: requestedName },
        profileResult,
      );
      const data = object(r.data);
      if (
        r.success &&
        requestedName === profile.node.value &&
        generation === previewGeneration &&
        data.current_digest &&
        data.profile_digest
      ) {
        previewName = requestedName;
        previewDigest = String(data.current_digest);
        previewProfileDigest = String(data.profile_digest);
        apply.disabled = false;
      }
    }),
    apply,
    profileName.wrap,
    action('Сохранить текущий профиль', async () => {
      invalidatePreview();
      await invoke(
        'profile_save',
        { name: profileName.node.value },
        profileResult,
      );
      await refreshProfiles();
    }),
    profileResult,
  );
  const rollback = action('Вернуть предыдущую конфигурацию', async () => {
    await invoke('rollback', { expected: digest }, profileResult);
    await refreshStatus();
  });
  rollback.disabled = true;
  profiles.append(rollback);
  const recoveryNotice = el(
    'p',
    'Применение было прервано. Восстановите транзакцию, затем проверьте результат.',
  );
  const recoveryResult = el('div', '', 'fkp-next-notice');
  recoveryResult.setAttribute('aria-live', 'polite');
  const recover = action('Восстановить прерванное применение', async () => {
    const result = await invoke('recover', {}, recoveryResult);
    if (!result.success)
      recoveryResult.append(
        el(
          'p',
          'Повторите восстановление после проверки связи и состояния сервиса. Причина отказа указана выше.',
        ),
      );
    await refreshStatus();
  });
  recoveryNotice.hidden = true;
  recover.hidden = true;
  const recovery = el('div');
  recovery.append(recoveryNotice, recover, recoveryResult);
  root.insertBefore(recovery, content);
  const temporary = panel(
    'Временные правила',
    'Правило автоматически перестанет действовать по истечении выбранного срока.',
    'rules',
  );
  const td = input('temporary_domain', 'Домен');
  const ts = connection();
  const ttl = select('Срок действия', [
    ['3600', '1 час'],
    ['14400', '4 часа'],
    ['86400', '24 часа'],
  ]);
  const tempList = el('div');
  let temporaryItems: Obj[] | undefined;
  temporary.append(
    td.wrap,
    ts.wrap,
    ttl.wrap,
    action('Добавить временное правило', async () => {
      await invoke('temporary_add', {
        domain: td.node.value.trim(),
        section: ts.node.value,
        ttl: Number(ttl.node.value),
      });
      await refreshTemporary();
    }),
    tempList,
  );
  const recommendations = panel(
    'Smart Detect',
    'Только рекомендации на основе наблюдений. Применение — по вашему решению.',
    'rules',
  );
  const rs = connection();
  const recList = el('div');
  const recommendationDomain = input(
    'recommendation_domain',
    'Домен для сравнения',
  );
  recommendationDomain.node.placeholder = 'example.org';
  const scanResult = el('p', '', 'fkp-next-result');
  let scanGeneration = 0;
  const scanKey = () =>
    JSON.stringify([recommendationDomain.node.value, rs.node.value]);
  function invalidateScan() {
    scanGeneration++;
    scanAction.disabled = false;
    scanResult.textContent = 'Параметры изменены — проверьте снова';
  }
  const autoDetect = input(
    'smart_detect_enabled',
    'Автоматически предлагать обход ошибок из журнала',
  );
  autoDetect.node.type = 'checkbox';
  autoDetect.wrap.className = 'fkp-next-check';
  const autoResult = el('p', '', 'fkp-next-result');
  autoResult.setAttribute('aria-live', 'polite');
  scanResult.setAttribute('aria-live', 'polite');
  const scanAction = action('Проверить другой маршрут', async () => {
    const generation = ++scanGeneration;
    const key = scanKey();
    const context = `Цель: ${recommendationDomain.node.value.trim()} · Подключение: ${rs.node.selectedOptions[0]?.textContent || rs.node.value} · Источник: с роутера, не с клиентского устройства · ${new Date().toLocaleString()}`;
    const r = await invoke('recommendation_scan', {
      domain: recommendationDomain.node.value.trim(),
      section: rs.node.value,
    });
    if (generation !== scanGeneration || key !== scanKey()) return;
    if (r.success) {
      const data = object(r.data);
      const current = object(data.current),
        target = object(data.section);
      scanResult.textContent = `Текущий маршрут: ${current.reachable === true ? 'есть сетевой ответ' : current.reachable === false ? 'нет ответа' : 'см. результаты проверки'}. Выбранное подключение: ${target.reachable === true ? 'есть сетевой ответ' : target.reachable === false ? 'нет ответа' : 'см. результаты проверки'}. ${context}. Рекомендация появляется после повторных наблюдений; правила автоматически не применяются.`;
      await refreshRecommendations();
    } else
      scanResult.textContent = `Сравнение не выполнено: ${r.error || 'неизвестная ошибка'}. ${context}`;
  });
  recommendationDomain.node.oninput = invalidateScan;
  rs.node.onchange = invalidateScan;
  recommendations.append(
    recommendationDomain.wrap,
    rs.wrap,
    scanAction,
    scanResult,
    recList,
  );
  recommendations.append(
    autoDetect.wrap,
    el(
      'p',
      'Поиск выполняется раз в минуту после включения. Маршруты меняются только после принятия рекомендации.',
    ),
    action('Сохранить автоматический поиск', async () => {
      const r = await invoke('smart_detect_configure', {
        enabled: autoDetect.node.checked,
        section: rs.node.value,
      });
      autoResult.textContent = r.success
        ? 'Настройки автоматического поиска сохранены.'
        : r.error === 'section_probe_unavailable'
          ? 'Включите локальный SOCKS для выбранного подключения в расширенных настройках и повторите действие.'
          : `Настройки не сохранены: ${r.error || 'неизвестная ошибка'}`;
    }),
    autoResult,
  );
  let statusGeneration = 0;
  let profilesGeneration = 0;
  async function refreshStatus(read: Request = request) {
    const current = ++statusGeneration;
    const r = await read('status', {});
    if (current !== statusGeneration) return;
    if (!r.success) {
      status.hidden = false;
      status.textContent =
        'Состояние недоступно. Обновите страницу или проверьте сервис.';
      return;
    }
    const d = object(r.data);
    const smart = object(d.smart_detect);
    autoDetect.node.checked = smart.enabled === true;
    const refreshedDigest = String(d.digest || '');
    if (digest && refreshedDigest !== digest) {
      invalidateRoute();
      invalidateProbe();
      invalidateScan();
    }
    if (previewName && refreshedDigest !== previewDigest) invalidatePreview();
    digest = refreshedDigest;
    const versions = object(d.versions);
    status.textContent =
      area === 'all'
        ? `Forkop ${versions.forkop || '—'} · sing-box ${versions.sing_box || '—'}${d.recovery_pending ? ' · Требуется восстановление' : ''}`
        : d.recovery_pending
          ? 'Требуется восстановление'
          : '';
    status.hidden = !status.textContent;
    rollback.disabled = !d.previous_available || d.recovery_pending === true;
    recoveryNotice.hidden = d.recovery_pending !== true;
    recover.hidden = d.recovery_pending !== true;
    recover.disabled = d.recovery_pending !== true;
    sections = (Array.isArray(d.sections) ? d.sections : []).map(
      (s: unknown) => {
        const o = object(s);
        return [String(o.name), String(o.label || o.name)];
      },
    );
    if (temporaryItems) showTemporary();
    const probeChoice = probeSection.node.value;
    probeSection.node.replaceChildren();
    for (const [value, label] of [
      ['', 'Текущий маршрут роутера'],
      ...sections,
    ]) {
      const option = el('option', label);
      option.value = value;
      probeSection.node.append(option);
    }
    probeSection.node.value = probeChoice;
    if (probeSection.node.value !== probeChoice) invalidateProbe();
    for (const s of sectionSelects) {
      const old = s.value;
      s.replaceChildren();
      for (const [value, label] of sections) {
        const o = el('option', label);
        o.value = value;
        s.append(o);
      }
      s.value = sections.some(([value]) => value === old)
        ? old
        : sections[0]?.[0] || '';
    }
    if (sections.some(([name]) => name === smart.section))
      rs.node.value = String(smart.section);
  }
  async function refreshProfiles(read: Request = request) {
    const current = ++profilesGeneration;
    invalidatePreview();
    const r = await read('profile_list', {});
    if (current !== profilesGeneration) return;
    if (!r.success) {
      message.textContent =
        'Не удалось загрузить профили. Нажмите «Обновить данные».';
      return;
    }
    profile.node.replaceChildren();
    for (const p of items(r.data)) {
      const o = el('option', String(p.name));
      o.value = String(p.name);
      profile.node.append(o);
    }
    apply.disabled = previewName !== profile.node.value || !previewName;
  }
  async function refreshTemporary() {
    const r = await request('temporary_list', {});
    if (!r.success) {
      message.textContent =
        'Не удалось загрузить временные правила. Нажмите «Обновить данные».';
      return;
    }
    temporaryItems = items(r.data);
    showTemporary();
  }
  function showTemporary() {
    tempList.replaceChildren();
    for (const t of temporaryItems || []) {
      const row = el('div', '', 'fkp-next-row');
      row.append(
        el(
          'span',
          `${t.domain} → ${connectionLabel(t.section)} · до ${new Date(Number(t.expires) * 1000).toLocaleString()}`,
        ),
        action('Удалить правило', async () => {
          await invoke('temporary_delete', { id: t.id });
          await refreshTemporary();
        }),
      );
      tempList.append(row);
    }
    if (!tempList.childNodes.length)
      tempList.append(el('p', 'Временных правил нет.'));
  }
  async function refreshRecommendations() {
    const r = await request('recommendations', {});
    if (!r.success) {
      message.textContent =
        'Не удалось загрузить рекомендации. Нажмите «Обновить данные».';
      return;
    }
    recList.replaceChildren();
    for (const rec of items(r.data)) {
      const row = el('div', '', 'fkp-next-row');
      row.append(
        el(
          'span',
          `${rec.domain} · ошибки текущего маршрута: ${rec.current_route_failures ?? '—'}, успешных через выбранное подключение: ${rec.proxy_successes ?? '—'}`,
        ),
        action('Принять рекомендацию', async () => {
          await invoke('recommendation_accept', {
            id: rec.id,
            section: rs.node.value,
          });
          await refreshRecommendations();
        }),
      );
      recList.append(row);
    }
    if (!recList.childNodes.length)
      recList.append(el('p', 'Рекомендаций пока нет.'));
  }
  function mountTools() {
    const tools = renderDeviceProfileTools(
      request,
      lazy ? request : initialRequest,
      area === 'devices' ? 'devices' : area === 'settings' ? 'profiles' : 'all',
    );
    tools.className = 'fkp-next-tools';
    return tools;
  }
  function mountCompatibility() {
    const compatibility = renderCompatibilityPanel(
      request,
      lazy ? request : initialRequest,
      !lazy || area === 'all',
    );
    compatibility.classList.add('fkp-next-compatibility');
    return compatibility;
  }
  if (lazy) {
    for (const [title, mount] of [
      ['Совместимость с 3x-ui и Xray', mountCompatibility],
      ['Устройства, игровые пресеты и обмен профилями', mountTools],
    ] as const) {
      if (mount === mountCompatibility && !includes('settings')) continue;
      if (mount === mountTools && !includes('devices') && !includes('settings'))
        continue;
      const details = el('details', '', 'fkp-next-disclosure');
      details.append(el('summary', title));
      let mounted = false;
      details.addEventListener('toggle', () => {
        if (details.open && !mounted) {
          mounted = true;
          details.append(mount());
        }
      });
      content.append(details);
    }
  } else {
    if (includes('settings')) content.append(mountCompatibility());
    if (includes('devices') || includes('settings'))
      content.append(mountTools());
  }
  const refreshVisible = async () => {
    message.textContent = '';
    const read = sharedReads();
    root
      .querySelectorAll('.fkp-next-tools,.fkp-next-compatibility')
      .forEach((child) =>
        child.dispatchEvent(
          new CustomEvent('forkop:refresh-tools', { detail: { read } }),
        ),
      );
    try {
      await Promise.all([
        refreshStatus(read),
        ...(includes('settings') && (!lazy || profiles.isConnected)
          ? [refreshProfiles(read)]
          : []),
        ...(includes('rules') && (!lazy || temporary.isConnected)
          ? [refreshTemporary()]
          : []),
        ...(includes('rules') && (!lazy || recommendations.isConnected)
          ? [refreshRecommendations()]
          : []),
        ...(area === 'all' ? [refreshConnections()] : []),
      ]);
    } catch {
      message.textContent =
        'Не удалось загрузить данные. Нажмите «Обновить данные».';
    }
  };
  header.append(action('Обновить данные', refreshVisible));
  root.addEventListener('forkop:refresh', () => {
    void refreshVisible();
  });
  root.addEventListener('forkop:profiles-changed', () => {
    if (includes('settings')) void refreshProfiles();
  });
  void Promise.all([
    refreshStatus(initialRequest),
    ...(!lazy
      ? [
          ...(includes('settings') ? [refreshProfiles(initialRequest)] : []),
          ...(includes('rules')
            ? [refreshTemporary(), refreshRecommendations()]
            : []),
        ]
      : []),
    ...(area === 'all' ? [refreshConnections()] : []),
  ]).catch(() => {
    message.textContent =
      'Не удалось загрузить данные. Нажмите «Обновить данные».';
  });
  return root;
}
