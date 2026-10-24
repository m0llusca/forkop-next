type Response = { success: boolean; data?: unknown; error?: string };
type Request = (
  action: string,
  payload: Record<string, unknown>,
) => Promise<Response>;

/** Native DOM controls, also usable outside the LuCI form lifecycle. */
export function renderDeviceProfileTools(
  request: Request,
  initialRequest: Request = request,
  area: 'all' | 'devices' | 'profiles' = 'all',
): HTMLElement {
  const root = document.createElement('section');
  root.className = 'fkp-next-panel';
  let group = root;
  const heading = (text: string) => {
    group = document.createElement('section');
    group.className = 'fkp-next-panel';
    const wanted =
      text === 'Импорт и экспорт профилей' ? 'profiles' : 'devices';
    if (area === 'all' || area === wanted) root.append(group);
    const h = document.createElement('h3');
    h.textContent = text;
    group.append(h);
  };
  const note = (text: string) => {
    const p = document.createElement('p');
    p.textContent = text;
    group.append(p);
  };
  const field = <K extends 'input' | 'select' | 'textarea'>(
    tag: K,
    name: string,
  ): HTMLElementTagNameMap[K] => {
    const label = document.createElement('label');
    label.textContent = name;
    const input = document.createElement(tag);
    input.setAttribute('aria-label', name);
    label.append(input);
    group.append(label);
    return input;
  };
  const result = (name: string) => {
    const output = document.createElement('output');
    output.setAttribute('aria-label', name);
    output.setAttribute('aria-live', 'polite');
    group.append(output);
    return output;
  };
  const options = (
    select: HTMLSelectElement,
    items: Array<{ value: string; label: string }>,
  ) => {
    const previous = select.value;
    select.replaceChildren();
    for (const item of [{ value: '', label: 'Выберите…' }, ...items]) {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      select.append(option);
    }
    if (items.some((item) => item.value === previous)) select.value = previous;
  };
  const call = async (
    action: string,
    payload: Record<string, unknown>,
    read: Request = request,
  ) => {
    const response = await read(action, payload);
    if (!response.success) throw new Error(response.error || 'request_failed');
    return response.data;
  };
  const button = (
    text: string,
    output: HTMLOutputElement,
    task: () => Promise<void>,
  ) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', async () => {
      b.disabled = true;
      output.textContent = 'Загрузка…';
      output.setAttribute('aria-busy', 'true');
      try {
        await task();
      } catch (error) {
        output.textContent =
          error instanceof Error ? error.message : 'request_failed';
      } finally {
        b.disabled = false;
        output.setAttribute('aria-busy', 'false');
      }
    });
    group.append(b);
    return b;
  };
  heading('Устройства');
  note(
    'Здесь показаны сохранённые назначения маршрутов. Остальные условия включения и исключения задаются в правилах.',
  );
  const rules = document.createElement('button');
  rules.type = 'button';
  rules.textContent = 'Открыть условия в правилах';
  rules.onclick = () =>
    root
      .closest('.cbi-map')
      ?.querySelector<HTMLAnchorElement>('.cbi-tabmenu [data-tab="section"] a')
      ?.click();
  group.append(rules);
  const devices = document.createElement('ul');
  group.append(devices);
  const device = field('input', 'Адрес устройства');
  const route = field('select', 'Маршрут устройства');
  options(route, []);
  const deviceResult = result('Результат устройства');
  let assignments: Array<{ address: string; section: string }> = [];
  const routeLabels = new Map<string, string>([['direct', 'Напрямую']]);
  const showDevices = () => {
    devices.replaceChildren();
    for (const item of assignments) {
      const li = document.createElement('li');
      li.textContent = `${item.address} → ${routeLabels.get(item.section) || item.section}`;
      devices.append(li);
    }
    if (!assignments.length)
      devices.textContent = 'Маршруты устройств пока не заданы.';
  };
  const loadDevices = async () => {
    const data = (await call('devices', {})) as {
      items: Array<{ address: string; section: string }>;
    };
    assignments = data.items;
    showDevices();
  };
  button('Сохранить маршрут устройства', deviceResult, async () => {
    if (!device.value.trim() || !route.value)
      throw new Error('Требуются адрес устройства и маршрут');
    await call('device_set', {
      address: device.value.trim(),
      section: route.value,
    });
    deviceResult.textContent = 'Маршрут устройства сохранён.';
    try {
      await loadDevices();
    } catch {
      deviceResult.textContent += ' Не удалось обновить список устройств.';
    }
  });
  button('Обновить устройства', deviceResult, async () => {
    await loadDevices();
    deviceResult.textContent = 'Список устройств обновлён.';
  });

  heading('Игровые пресеты');
  note(
    'Пресеты направляют домены магазинов и загрузок. Игровые сессии сохраняют текущую маршрутизацию.',
  );
  const gamingDevice = field('input', 'Игровое устройство');
  const preset = field('select', 'Игровой пресет');
  options(preset, [
    { value: 'steam', label: 'Steam' },
    { value: 'playstation', label: 'PlayStation' },
    { value: 'xbox', label: 'Xbox' },
  ]);
  const gamingRoute = field('select', 'Игровой маршрут');
  options(gamingRoute, []);
  const gamingResult = result('Результат игрового пресета');
  button('Применить игровой пресет', gamingResult, async () => {
    if (!preset.value || !gamingRoute.value)
      throw new Error('Требуются игровой пресет и маршрут');
    const payload: Record<string, unknown> = {
      preset: preset.value,
      section: gamingRoute.value,
    };
    if (gamingDevice.value.trim()) payload.device = gamingDevice.value.trim();
    await call('gaming_apply', payload);
    gamingResult.textContent = 'Игровой пресет применён.';
  });

  heading('Импорт и экспорт профилей');
  note(
    'Экспорт содержит пароли и ключи. Храните файл в защищённом месте. Импорт сохраняет профиль без активации.',
  );
  const exportName = field('select', 'Профиль для экспорта');
  options(exportName, []);
  const profileResult = result('Результат профиля');
  const loadProfiles = async (read: Request = request) => {
    const data = (await call('profile_list', {}, read)) as {
      items: Array<{ name: string }>;
    };
    options(
      exportName,
      data.items.map((item) => ({ value: item.name, label: item.name })),
    );
  };
  button('Скачать профиль', profileResult, async () => {
    if (!exportName.value) throw new Error('Требуется профиль для экспорта');
    const data = (await call('profile_export', { name: exportName.value })) as {
      name: string;
      config: string;
    };
    if (typeof data.config !== 'string') throw new Error('invalid_response');
    const url = URL.createObjectURL(
      new Blob([data.config], { type: 'text/plain;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${data.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}.uci`;
    anchor.hidden = true;
    root.append(anchor);
    try {
      anchor.click();
      profileResult.textContent = 'Скачивание профиля начато.';
    } finally {
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  });
  const name = field('input', 'Название импортируемого профиля');
  const file = field('input', 'Файл профиля');
  file.type = 'file';
  file.accept = '.uci,.conf,.txt';
  const config = field('textarea', 'Конфигурация профиля');
  config.rows = 5;
  config.autocomplete = 'off';
  let fileReadGeneration = 0;
  file.addEventListener('change', async () => {
    const generation = ++fileReadGeneration;
    const selected = file.files?.[0];
    if (!selected) return;
    try {
      const text = await selected.text();
      if (generation !== fileReadGeneration) return;
      config.value = text;
      if (!name.value.trim())
        name.value = selected.name.replace(/\.[^.]+$/, '');
      profileResult.textContent =
        'Файл загружен. Проверьте конфигурацию и импортируйте профиль.';
    } catch {
      if (generation !== fileReadGeneration) return;
      profileResult.textContent = 'file_read_failed';
    }
  });
  button('Импортировать профиль', profileResult, async () => {
    if (!name.value.trim() || !config.value.trim())
      throw new Error('Требуются название профиля и конфигурация');
    await call('profile_import', {
      name: name.value.trim(),
      config: config.value,
    });
    config.value = '';
    file.value = '';
    profileResult.textContent = 'Профиль импортирован без активации.';
    root.dispatchEvent(
      new CustomEvent('forkop:profiles-changed', { bubbles: true }),
    );
    try {
      await loadProfiles();
    } catch {
      profileResult.textContent += ' Не удалось обновить список профилей.';
    }
  });
  button('Обновить профили', profileResult, async () => {
    await loadProfiles();
    profileResult.textContent = 'Список профилей обновлён.';
  });

  if (area !== 'profiles') {
    deviceResult.textContent = 'Загрузка устройств…';
    void loadDevices()
      .then(() => {
        deviceResult.textContent = '';
      })
      .catch((error) => {
        deviceResult.textContent =
          error instanceof Error ? error.message : 'device_read_failed';
      });
  }
  if (area !== 'devices') {
    profileResult.textContent = 'Загрузка профилей…';
    void loadProfiles(initialRequest)
      .then(() => {
        profileResult.textContent = '';
      })
      .catch((error) => {
        profileResult.textContent =
          error instanceof Error ? error.message : 'profile_read_failed';
      });
  }
  let routesGeneration = 0;
  const loadRoutes = (read = request) => {
    const generation = ++routesGeneration;
    return call('status', {}, read).then((raw) => {
      if (generation !== routesGeneration) return;
      const data = raw as { sections: Array<{ name: string; label?: string }> };
      const items = data.sections.map((section) => ({
        value: section.name,
        label: section.label || section.name,
      }));
      for (const item of items) routeLabels.set(item.value, item.label);
      showDevices();
      options(route, [
        { value: 'direct', label: 'Напрямую' },
        ...items.filter((item) => item.value !== 'direct'),
      ]);
      options(gamingRoute, items);
    });
  };
  const routeError = () =>
    (gamingResult.textContent =
      'Не удалось загрузить маршруты. Нажмите «Обновить маршруты».');
  if (area !== 'profiles') {
    void loadRoutes(initialRequest).catch(routeError);
    // Keep entered addresses when route loading fails; retry only the read.
    group = route.closest('section')!;
    button('Обновить маршруты', gamingResult, async () => {
      await loadRoutes();
      gamingResult.textContent = 'Маршруты обновлены.';
    });
  }
  root.addEventListener('forkop:refresh-tools', (event) => {
    const read =
      (event as CustomEvent<{ read?: Request }>).detail?.read || request;
    if (area !== 'profiles') {
      void loadDevices().catch(
        () =>
          (deviceResult.textContent =
            'Не удалось загрузить устройства. Нажмите «Обновить устройства».'),
      );
      void loadRoutes(read).catch(routeError);
    }
    if (area !== 'devices')
      void loadProfiles(read).catch(
        () =>
          (profileResult.textContent =
            'Не удалось загрузить профили. Нажмите «Обновить профили».'),
      );
  });
  return root;
}
