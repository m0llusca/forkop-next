import { renderDeviceProfileTools } from './tools';
import { renderCompatibilityPanel } from './compatibility';
import { nextRequest, type NextResponse } from './api';
type Obj = Record<string, unknown>;
type Request = (action: string, payload?: Obj) => Promise<NextResponse>;
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
type ConnectionLoader = () => Promise<{
  success: boolean;
  data?: Array<{
    displayName: string;
    outbounds: Array<{
      displayName: string;
      selected: boolean;
      latency: number;
      latencyTestedAt?: string;
    }>;
  }>;
}>;
export function renderNextPanel(
  request: Request = nextRequest,
  loadConnections?: ConnectionLoader,
): HTMLElement {
  const root = el('section', '', 'fkp-next');
  root.dataset.mode = 'simple';
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
  let previewName = '';
  const sectionSelects: HTMLSelectElement[] = [];
  function connection(label = 'Подключение') {
    const s = select(label, sections);
    sectionSelects.push(s.node);
    return s;
  }
  function panel(title: string, help: string) {
    const p = el('section', '', 'fkp-next-panel');
    p.append(el('h3', title), el('p', help, 'fkp-next-help'));
    content.append(p);
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
      if (output)
        output.textContent = JSON.stringify(
          result.data ?? { error: result.error },
          null,
          2,
        );
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
  );
  const domain = input('domain', 'Домен');
  domain.node.placeholder = 'example.org';
  const device = input('device', 'IP устройства (необязательно)');
  const routeResult = el('div', '', 'fkp-next-result');
  routeResult.setAttribute('aria-live', 'polite');
  route.append(
    domain.wrap,
    device.wrap,
    action('Объяснить маршрут', async () => {
      const r = await invoke('route_explain', {
        domain: domain.node.value.trim(),
        device: device.node.value.trim(),
        port: 443,
        protocol: 'tcp',
      });
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
      const connectionLabel =
        sections.find(([name]) => name === decision.section)?.[1] ||
        decision.section ||
        decision.outbound ||
        '—';
      routeResult.append(
        el(
          'strong',
          `${decisionLabels[String(decision.status)] || 'Не определено'} → ${connectionLabel}`,
        ),
        el('p', 'Доступность сайта не проверялась'),
      );
      const trace = el('ol');
      trace.dataset.detail = 'true';
      trace.hidden = root.dataset.mode !== 'detailed';
      for (const step of Array.isArray(data.trace) ? data.trace : []) {
        const row = object(step);
        trace.append(
          el('li', `${row.section || ''}: ${row.reason || row.match || ''}`),
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
  route.append(
    probeSection.wrap,
    action('Проверить доступность', async () => {
      const payload: Obj = { domain: domain.node.value.trim() };
      if (probeSection.node.value) payload.section = probeSection.node.value;
      const r = await invoke('probe', payload);
      if (!r.success) {
        probeResult.textContent = `Проверка не выполнена: ${r.error}`;
        return;
      }
      const d = object(r.data);
      probeResult.textContent = `${d.reachable ? 'Сайт доступен' : 'Сайт недоступен'} · HTTP ${d.http_status || '—'} · ${d.duration_ms ?? '—'} мс. Проверен сетевой доступ с роутера; вход в сервис не проверяется.`;
    }),
    probeResult,
  );
  const profiles = panel(
    'Профили и восстановление',
    'Сначала сравните профиль. При применении сохраняется предыдущая рабочая конфигурация.',
  );
  const profile = select('Сохранённый профиль', []);
  const profileName = input('profile_name', 'Название нового профиля');
  const profileResult = el('pre', '', 'fkp-next-result');
  const apply = action('Применить профиль', async () => {
    await invoke(
      'profile_apply',
      { name: profile.node.value, expected: digest },
      profileResult,
    );
    previewName = '';
    await refreshStatus();
    apply.disabled = true;
  });
  apply.disabled = true;
  profile.node.onchange = () => {
    previewName = '';
    apply.disabled = true;
  };
  profiles.append(
    profile.wrap,
    action('Сравнить профиль', async () => {
      const requestedName = profile.node.value;
      const r = await invoke(
        'profile_diff',
        { name: requestedName },
        profileResult,
      );
      if (r.success && requestedName === profile.node.value) {
        previewName = requestedName;
        digest = String(object(r.data).current_digest || digest);
        apply.disabled = false;
      }
    }),
    apply,
    profileName.wrap,
    action('Сохранить текущий профиль', async () => {
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
  const temporary = panel(
    'Временные правила',
    'Правило автоматически перестанет действовать по истечении выбранного срока.',
  );
  const td = input('temporary_domain', 'Домен');
  const ts = connection();
  const ttl = select('Срок действия', [
    ['3600', '1 час'],
    ['14400', '4 часа'],
    ['86400', '24 часа'],
  ]);
  const tempList = el('div');
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
  );
  const rs = connection();
  const recList = el('div');
  const recommendationDomain = input(
    'recommendation_domain',
    'Домен для сравнения',
  );
  recommendationDomain.node.placeholder = 'example.org';
  const scanResult = el('p', '', 'fkp-next-result');
  const autoDetect = input(
    'smart_detect_enabled',
    'Автоматически предлагать обход ошибок из журнала',
  );
  autoDetect.node.type = 'checkbox';
  autoDetect.wrap.className = 'fkp-next-check';
  const autoResult = el('p', '', 'fkp-next-result');
  autoResult.setAttribute('aria-live', 'polite');
  scanResult.setAttribute('aria-live', 'polite');
  recommendations.append(
    recommendationDomain.wrap,
    rs.wrap,
    action('Проверить другой маршрут', async () => {
      const r = await invoke('recommendation_scan', {
        domain: recommendationDomain.node.value.trim(),
        section: rs.node.value,
      });
      if (r.success) {
        const data = object(r.data);
        const current = object(data.current),
          target = object(data.section);
        scanResult.textContent = `Текущий маршрут: ${current.reachable === true ? 'есть сетевой ответ' : current.reachable === false ? 'нет ответа' : 'см. результаты проверки'}. Выбранное подключение: ${target.reachable === true ? 'есть сетевой ответ' : target.reachable === false ? 'нет ответа' : 'см. результаты проверки'}. Рекомендация появляется после повторных наблюдений; правила автоматически не применяются.`;
        await refreshRecommendations();
      } else
        scanResult.textContent = `Сравнение не выполнено: ${r.error || 'неизвестная ошибка'}`;
    }),
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
  async function refreshStatus() {
    const r = await request('status', {});
    if (!r.success) {
      status.textContent =
        'Состояние недоступно. Обновите страницу или проверьте сервис.';
      return;
    }
    const d = object(r.data);
    const smart = object(d.smart_detect);
    autoDetect.node.checked = smart.enabled === true;
    digest = String(d.digest || '');
    const versions = object(d.versions);
    status.textContent = `Forkop ${versions.forkop || '—'} · sing-box ${versions.sing_box || '—'}${d.recovery_pending ? ' · Требуется восстановление' : ''}`;
    rollback.disabled = !d.previous_available;
    sections = (Array.isArray(d.sections) ? d.sections : []).map(
      (s: unknown) => {
        const o = object(s);
        return [String(o.name), String(o.label || o.name)];
      },
    );
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
  async function refreshProfiles() {
    const r = await request('profile_list', {});
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
    tempList.replaceChildren();
    for (const t of items(r.data)) {
      const row = el('div', '', 'fkp-next-row');
      row.append(
        el(
          'span',
          `${t.domain} → ${t.section} · до ${new Date(Number(t.expires) * 1000).toLocaleString()}`,
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
  const tools = renderDeviceProfileTools(request);
  tools.className = 'fkp-next-tools';
  let group: HTMLElement | undefined;
  for (const child of [...tools.children]) {
    if (child.tagName === 'H3') {
      group = el('section', '', 'fkp-next-panel');
      tools.append(group);
    }
    group?.append(child);
  }
  const compatibility = renderCompatibilityPanel(request);
  compatibility.classList.add('fkp-next-compatibility');
  content.append(compatibility, tools);
  header.append(
    action('Обновить данные', async () => {
      message.textContent = '';
      await Promise.all([
        refreshStatus(),
        refreshProfiles(),
        refreshTemporary(),
        refreshRecommendations(),
        refreshConnections(),
      ]);
    }),
  );
  root.addEventListener(
    'forkop:profiles-changed',
    () => void refreshProfiles(),
  );
  void Promise.all([
    refreshStatus(),
    refreshProfiles(),
    refreshTemporary(),
    refreshRecommendations(),
    refreshConnections(),
  ]);
  return root;
}
