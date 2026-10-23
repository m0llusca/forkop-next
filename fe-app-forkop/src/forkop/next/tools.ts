type Response = { success: boolean; data?: unknown; error?: string };
type Request = (
  action: string,
  payload: Record<string, unknown>,
) => Promise<Response>;

/** Native DOM controls, also usable outside the LuCI form lifecycle. */
export function renderDeviceProfileTools(request: Request): HTMLElement {
  const root = document.createElement('section');
  root.className = 'fkp-next-panel';
  const heading = (text: string) => {
    const h = document.createElement('h3');
    h.textContent = text;
    root.append(h);
  };
  const note = (text: string) => {
    const p = document.createElement('p');
    p.textContent = text;
    root.append(p);
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
    root.append(label);
    return input;
  };
  const result = (name: string) => {
    const output = document.createElement('output');
    output.setAttribute('aria-label', name);
    output.setAttribute('aria-live', 'polite');
    root.append(output);
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
  const call = async (action: string, payload: Record<string, unknown>) => {
    const response = await request(action, payload);
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
    root.append(b);
    return b;
  };
  heading('Устройства');
  const devices = document.createElement('ul');
  root.append(devices);
  const device = field('input', 'Адрес устройства');
  const route = field('select', 'Маршрут устройства');
  options(route, []);
  const deviceResult = result('Результат устройства');
  const loadDevices = async () => {
    const data = (await call('devices', {})) as {
      items: Array<{ address: string; section: string }>;
    };
    devices.replaceChildren();
    for (const item of data.items) {
      const li = document.createElement('li');
      li.textContent = `${item.address} → ${item.section}`;
      devices.append(li);
    }
    if (!data.items.length)
      devices.textContent = 'Маршруты устройств пока не заданы.';
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
  const loadProfiles = async () => {
    const data = (await call('profile_list', {})) as {
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
  file.addEventListener('change', async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    try {
      config.value = await selected.text();
      if (!name.value.trim())
        name.value = selected.name.replace(/\.[^.]+$/, '');
      profileResult.textContent =
        'Файл загружен. Проверьте конфигурацию и импортируйте профиль.';
    } catch {
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

  deviceResult.textContent = 'Загрузка устройств…';
  void loadDevices()
    .then(() => {
      deviceResult.textContent = '';
    })
    .catch((error) => {
      deviceResult.textContent =
        error instanceof Error ? error.message : 'device_read_failed';
    });
  profileResult.textContent = 'Загрузка профилей…';
  void loadProfiles()
    .then(() => {
      profileResult.textContent = '';
    })
    .catch((error) => {
      profileResult.textContent =
        error instanceof Error ? error.message : 'profile_read_failed';
    });
  void call('status', {})
    .then((raw) => {
      const data = raw as { sections: Array<{ name: string; label?: string }> };
      const items = data.sections.map((section) => ({
        value: section.name,
        label: section.label || section.name,
      }));
      options(route, [
        { value: 'direct', label: 'Напрямую' },
        ...items.filter((item) => item.value !== 'direct'),
      ]);
      options(gamingRoute, items);
    })
    .catch(() => {
      gamingResult.textContent =
        'Не удалось загрузить маршруты. Обновите панель для повторной попытки.';
    });
  return root;
}
