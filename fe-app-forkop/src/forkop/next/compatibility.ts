import type { NextResponse } from './api';
type Obj = Record<string, unknown>;
const object = (v: unknown): Obj =>
  v && typeof v === 'object' ? (v as Obj) : {};
export function renderCompatibilityPanel(
  request: (action: string, payload?: Obj) => Promise<NextResponse>,
  initialRequest = request,
): HTMLElement {
  const root = document.createElement('section');
  root.className = 'fkp-next-panel';
  const text = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    value: string,
  ) => {
    const e = document.createElement(tag);
    e.textContent = value;
    return e;
  };
  root.append(
    text('h3', 'Совместимость с 3x-ui и Xray'),
    text(
      'p',
      'Сопоставьте транспорт, flow, шифрование и TLS, затем проверьте реальное соединение. Версии сами по себе не подтверждают совместимость.',
    ),
  );
  const sectionLabel = text('label', 'Подключение');
  const section = document.createElement('select');
  sectionLabel.append(section);
  const outboundLabel = text('label', 'Сервер для проверки');
  const outbound = document.createElement('select');
  outboundLabel.append(outbound);
  const domainLabel = text('label', 'Сайт для проверки соединения');
  const domain = document.createElement('input');
  domain.name = 'compatibility_domain';
  domain.placeholder = 'example.org';
  domainLabel.append(domain);
  const serverLabel = text('label', 'Параметры сервера (JSON, необязательно)');
  const server = document.createElement('textarea');
  server.rows = 4;
  server.autocomplete = 'off';
  server.spellcheck = false;
  serverLabel.append(server);
  const help = text(
    'p',
    'Можно вставить параметры входящего подключения из 3x-ui. Данные используются для сопоставления; пароли и ключи не выводятся в результатах.',
  );
  const result = text('div', 'Проверка не выполнялась');
  result.className = 'fkp-next-result';
  result.setAttribute('role', 'status');
  root.append(
    sectionLabel,
    outboundLabel,
    domainLabel,
    serverLabel,
    help,
    result,
  );
  function button(label: string, work: () => Promise<void>) {
    const b = text('button', label);
    b.type = 'button';
    b.onclick = async () => {
      b.disabled = true;
      try {
        await work();
      } catch {
        result.textContent = 'Нет связи с роутером. Повторите проверку.';
      } finally {
        b.disabled = b === handshake && !outbound.value;
      }
    };
    root.append(b);
    return b;
  }
  let comparisonGeneration = 0;
  const comparison = async (probe = false) => {
    const generation = ++comparisonGeneration;
    const payload: Obj = { section: section.value };
    if (outbound.value) payload.outbound_tag = outbound.value;
    if (server.value.trim()) {
      try {
        const value = JSON.parse(server.value);
        if (!value || typeof value !== 'object' || Array.isArray(value))
          throw new Error();
        payload.server = value;
      } catch {
        result.textContent = 'Проверьте JSON параметров сервера.';
        return;
      }
    }
    if (probe) {
      if (!domain.value.trim() || !outbound.value) {
        result.textContent =
          'Сначала сопоставьте настройки, выберите сервер и укажите сайт для проверки.';
        return;
      }
      payload.probe = true;
      payload.domain = domain.value.trim();
    }
    result.textContent = probe
      ? 'Проверяем соединение…'
      : 'Сопоставляем параметры…';
    let response: NextResponse;
    try {
      response = await request('compatibility_check', payload);
    } catch (error) {
      if (generation !== comparisonGeneration) return;
      throw error;
    }
    if (generation !== comparisonGeneration) return;
    if (!response.success) {
      result.textContent = `Проверка не выполнена: ${response.error || 'неизвестная ошибка'}`;
      return;
    }
    const data = object(response.data);
    const oldOutbound = outbound.value;
    outbound.replaceChildren();
    for (const raw of Array.isArray(data.outbounds) ? data.outbounds : []) {
      const item = object(raw);
      const option = text('option', String(item.label || item.outbound_tag));
      option.value = String(item.outbound_tag);
      outbound.append(option);
    }
    outbound.value = [...outbound.options].some((o) => o.value === oldOutbound)
      ? oldOutbound
      : outbound.options[0]?.value || '';
    handshake.disabled = !outbound.value;
    const status = String(data.status);
    const labels: Record<string, string> = {
      probe_required: 'Нужна проверка соединения',
      unsupported: 'Обнаружены несовместимые параметры',
      verified: 'Соединение проверено',
    };
    result.replaceChildren(
      text('strong', labels[status] || 'Совместимость неизвестна'),
    );
    const versions = object(data.client),
      remote = object(data.server);
    result.append(
      text(
        'p',
        `sing-box: ${versions.version || 'неизвестно'} · 3x-ui: ${remote.panel_version || 'неизвестно'} · Xray: ${remote.xray_version || 'неизвестно'}`,
      ),
    );
    const checks = document.createElement('ul');
    for (const raw of Array.isArray(data.checks) ? data.checks : []) {
      const c = object(raw);
      checks.append(
        text(
          'li',
          `${c.capability || 'Параметр'}: ${c.status || 'unknown'} — ${c.detail || ''}${c.next_step ? ' · ' + c.next_step : ''}`,
        ),
      );
    }
    result.append(checks);
    if (data.probe) {
      const p = object(data.probe);
      result.append(
        text(
          'p',
          `Соединение: ${p.reachable ? 'есть сетевой ответ' : 'не подтверждено'} · HTTP ${p.http_status || '—'} · ${p.duration_ms ?? '—'} мс`,
        ),
      );
    }
    result.append(
      text(
        'p',
        'Проверка относится к выбранному подключению. Доступ к аккаунту и всем функциям сайта отдельно не проверяется.',
      ),
    );
  };
  button('Сопоставить настройки', () => comparison(false));
  const handshake = button('Проверить соединение', () => comparison(true));
  handshake.disabled = true;
  section.onchange = () => {
    comparisonGeneration++;
    outbound.replaceChildren();
    handshake.disabled = true;
    result.textContent = 'Подключение изменено. Сопоставьте настройки заново.';
  };
  const updates = text('div', '');
  updates.className = 'fkp-next-result';
  updates.setAttribute('role', 'status');
  const panelVersionLabel = text(
    'label',
    'Установленная версия 3x-ui (если известна)',
  );
  const panelVersion = document.createElement('input');
  panelVersion.name = 'compatibility_panel_version';
  panelVersionLabel.append(panelVersion);
  const xrayVersionLabel = text(
    'label',
    'Установленная версия Xray (если известна)',
  );
  const xrayVersion = document.createElement('input');
  xrayVersion.name = 'compatibility_xray_version';
  xrayVersionLabel.append(xrayVersion);
  root.append(panelVersionLabel, xrayVersionLabel);
  button('Проверить обновления 3x-ui и Xray', async () => {
    updates.textContent = 'Проверяем официальные релизы…';
    const installed: Obj = {};
    if (panelVersion.value.trim()) installed.panel = panelVersion.value.trim();
    if (xrayVersion.value.trim()) installed.xray = xrayVersion.value.trim();
    const response = await request(
      'compatibility_updates',
      Object.keys(installed).length ? { installed } : {},
    );
    if (!response.success) {
      updates.textContent = `Проверка обновлений не выполнена: ${response.error || 'неизвестная ошибка'}`;
      return;
    }
    updates.replaceChildren();
    const d = object(response.data);
    for (const raw of Array.isArray(d.updates) ? d.updates : []) {
      const u = object(raw);
      const status =
        u.status === 'update_available'
          ? 'Доступно обновление'
          : u.status === 'current'
            ? 'Установлена актуальная версия'
            : 'Статус обновления неизвестен';
      updates.append(
        text(
          'p',
          `${u.component}: ${status}. Установлено: ${u.installed || 'неизвестно'}, последняя: ${u.latest || 'неизвестно'}`,
        ),
      );
      if (typeof u.url === 'string') {
        try {
          const url = new URL(u.url);
          if (url.protocol === 'https:' && url.hostname === 'github.com') {
            const link = text('a', 'Официальный релиз');
            link.href = url.href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            updates.append(link);
          }
        } catch {
          /* Invalid source URLs remain unlinked. */
        }
      }
    }
    updates.append(
      text(
        'p',
        'Автоматическая установка отключена. Обновление сервера выполняется отдельно после проверки резервной копии.',
      ),
    );
  });
  root.append(updates);
  let routesGeneration = 0;
  function refreshRoutes(read = request) {
    const generation = ++routesGeneration;
    return read('status', {})
      .then((response) => {
        if (generation !== routesGeneration) return;
        if (!response.success) {
          result.textContent =
            'Не удалось загрузить подключения. Нажмите «Обновить подключения».';
          return;
        }
        const previous = section.value;
        section.replaceChildren();
        const sections = object(response.data).sections;
        for (const raw of Array.isArray(sections) ? sections : []) {
          const s = object(raw);
          const option = text('option', String(s.label || s.name));
          option.value = String(s.name);
          section.append(option);
        }
        section.value = [...section.options].some(
          (option) => option.value === previous,
        )
          ? previous
          : section.options[0]?.value || '';
        if (section.value !== previous)
          section.dispatchEvent(new Event('change'));
        result.textContent = 'Подключения загружены. Проверка не выполнялась.';
      })
      .catch(() => {
        if (generation === routesGeneration)
          result.textContent =
            'Не удалось загрузить подключения. Нажмите «Обновить подключения».';
      });
  }
  button('Обновить подключения', async () => {
    await refreshRoutes();
  });
  root.addEventListener(
    'forkop:refresh-tools',
    (event) =>
      void refreshRoutes(
        (event as CustomEvent<{ read?: typeof request }>).detail?.read ||
          request,
      ),
  );
  void refreshRoutes(initialRequest);
  return root;
}
