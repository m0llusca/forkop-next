import {
  navigateToRule,
  workflowContext,
  attachDevicePicker,
  requireIPv4,
  targetEligibility,
  workflowError,
  type WorkflowTarget,
} from './workflows';
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
    items: Array<{ value: string; label: string; disabled?: boolean }>,
  ) => {
    const previous = select.value;
    select.replaceChildren();
    for (const item of [{ value: '', label: 'Выберите…' }, ...items]) {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      option.disabled = 'disabled' in item && item.disabled === true;
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
        output.textContent = workflowError(error);
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
  attachDevicePicker(device, root);
  note(
    'Выберите имя и IPv4 из подсказок DHCP или введите IPv4 вручную. Подсказка DHCP не подтверждает, что устройство сейчас онлайн. Назначение IPv6 здесь пока не поддерживается.',
  );
  const route = field('select', 'Маршрут устройства');
  options(route, []);
  const deviceResult = result('Результат устройства');
  let assignments: Array<{ address: string; section: string }> = [];
  const routeLabels = new Map<string, string>([
    ['direct', 'Всегда напрямую'],
    ['nxt_direct', 'Всегда напрямую'],
    ['', 'По общим правилам'],
  ]);
  const showDevices = () => {
    devices.replaceChildren();
    for (const item of assignments) {
      const li = document.createElement('li');
      li.textContent = `${item.address} → ${routeLabels.get(item.section) || item.section}`;
      try {
        requireIPv4(item.address);
      } catch {
        const native = document.createElement('button');
        native.type = 'button';
        native.textContent = 'Изменить в полном редакторе';
        native.onclick = () => {
          if (
            !navigateToRule(root, {
              kind: 'edit',
              section: item.section,
              option: 'fully_routed_ips',
            })
          )
            deviceResult.textContent =
              'Откройте это правило в полном редакторе: IPv6 и подсети сохраняются без изменений.';
        };
        li.append(native);
        devices.append(li);
        continue;
      }
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Изменить';
      edit.onclick = () => {
        device.value = item.address;
        route.value = item.section === 'nxt_direct' ? 'direct' : item.section;
        device.focus();
      };
      const reset = button('По общим правилам', deviceResult, async () => {
        await saveDevice(item.address, '');
      });
      li.append(edit, reset);
      devices.append(li);
    }
    if (!assignments.length)
      devices.textContent = 'Маршруты устройств пока не заданы.';
  };
  let deviceGeneration = 0;
  let devicesUpdated = '';
  const loadDevices = async (read: Request = request) => {
    const generation = ++deviceGeneration;
    try {
      const data = (await call('devices', {}, read)) as {
        items: Array<{ address: string; section: string }>;
      };
      if (generation !== deviceGeneration) return false;
      if (!Array.isArray(data?.items)) throw Error('invalid_response');
      assignments = data.items;
      devicesUpdated = new Date().toLocaleString();
      showDevices();
      deviceResult.textContent = `Список устройств обновлён: ${devicesUpdated}.`;
      return true;
    } catch (error) {
      if (generation !== deviceGeneration) return false;
      deviceResult.textContent = `${workflowError(error)}. Не удалось обновить устройства.${devicesUpdated ? ` Показаны данные от ${devicesUpdated}.` : ' Нажмите «Обновить устройства».'}`;
      return false;
    }
  };
  const saveDevice = async (raw: string, section: string) => {
    const address = requireIPv4(raw);
    ++deviceGeneration;
    await call('device_set', { address, section });
    const refreshed = await loadDevices();
    deviceResult.textContent = `Маршрут устройства сохранён и применён: ${address} → ${routeLabels.get(section) || section}.${refreshed ? '' : ' Не удалось обновить список устройств; показаны прежние данные.'}`;
  };
  button('Сохранить маршрут устройства', deviceResult, async () => {
    if (!device.value.trim() || !route.value)
      throw new Error('Требуются адрес устройства и маршрут');
    await saveDevice(
      device.value,
      route.value === 'inherit' ? '' : route.value,
    );
  });
  button('Обновить устройства', deviceResult, async () => {
    await loadDevices();
  });

  heading('Игровые пресеты');
  note(
    'Пресеты направляют домены магазинов и загрузок. Игровые сессии сохраняют текущую маршрутизацию.',
  );
  const scope = field('select', 'Охват игрового пресета');
  options(scope, [
    { value: 'all', label: 'Все устройства' },
    { value: 'selected', label: 'Выбранное устройство' },
  ]);
  const gamingDevice = field('input', 'Игровое устройство');
  attachDevicePicker(gamingDevice, root);
  note(
    'Для выбранного устройства нужен IPv4. Подсказки DHCP не являются онлайн-статусом.',
  );
  const preset = field('select', 'Игровой пресет');
  options(preset, [
    { value: 'steam', label: 'Steam' },
    { value: 'playstation', label: 'PlayStation' },
    { value: 'xbox', label: 'Xbox' },
  ]);
  const gamingRoute = field('select', 'Игровой маршрут');
  options(gamingRoute, []);
  const gamingPreview = result('Предварительный охват пресета');
  const showScope = () => {
    gamingDevice.disabled = scope.value !== 'selected';
    gamingPreview.textContent = scope.value
      ? `Этот пресет затронет ${scope.value === 'all' ? 'все устройства' : gamingDevice.value.trim() || 'выбранное устройство — укажите IPv4'} → ${routeLabels.get(gamingRoute.value) || 'выберите маршрут'}.`
      : 'Выберите явно: все устройства или выбранное устройство.';
  };
  scope.onchange = showScope;
  gamingDevice.oninput = showScope;
  gamingRoute.onchange = showScope;
  showScope();
  const gamingResult = result('Результат игрового пресета');
  button('Применить игровой пресет', gamingResult, async () => {
    if (!preset.value || !gamingRoute.value)
      throw new Error('Требуются игровой пресет и маршрут');
    if (!scope.value)
      throw new Error(
        'Выберите охват игрового пресета: все устройства или выбранное устройство',
      );
    if (gamingRoute.selectedOptions[0]?.disabled)
      throw new Error('Выберите доступный игровой маршрут');
    const payload: Record<string, unknown> = {
      preset: preset.value,
      section: gamingRoute.value,
    };
    if (scope.value === 'selected')
      payload.device = requireIPv4(gamingDevice.value);
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
  let profilesGeneration = 0;
  let profilesUpdated = '';
  const loadProfiles = async (read: Request = request, announce = true) => {
    const generation = ++profilesGeneration;
    try {
      const data = (await call('profile_list', {}, read)) as {
        items: Array<{ name: string }>;
      };
      if (generation !== profilesGeneration) return false;
      if (!Array.isArray(data?.items)) throw Error('invalid_response');
      options(
        exportName,
        data.items.map((item) => ({ value: item.name, label: item.name })),
      );
      profilesUpdated = new Date().toLocaleString();
      if (announce)
        profileResult.textContent = `Список профилей обновлён: ${profilesUpdated}.`;
      return true;
    } catch (error) {
      if (generation !== profilesGeneration) return false;
      if (announce)
        profileResult.textContent = `${workflowError(error)}. Не удалось обновить профили.${profilesUpdated ? ` Показаны данные от ${profilesUpdated}.` : ' Нажмите «Обновить профили».'}`;
      return false;
    }
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
    if (!(await loadProfiles(request, false)))
      profileResult.textContent += ' Не удалось обновить список профилей.';
  });
  button('Обновить профили', profileResult, async () => {
    await loadProfiles();
  });

  if (area !== 'profiles') {
    deviceResult.textContent = 'Загрузка устройств…';
    void loadDevices(initialRequest);
  }
  if (area !== 'devices') {
    profileResult.textContent = 'Загрузка профилей…';
    void loadProfiles(initialRequest);
  }
  let routesGeneration = 0;
  let routesUpdated = '';
  const routesFreshness = document.createElement('p');
  routesFreshness.setAttribute('aria-label', 'Актуальность маршрутов');
  gamingResult.after(routesFreshness);
  const loadRoutes = (read = request, announce = false) => {
    const generation = ++routesGeneration;
    return call('status', {}, read)
      .then((raw) => {
        if (generation !== routesGeneration) return;
        const data = raw as {
          sections: WorkflowTarget[];
        };
        if (!Array.isArray(data?.sections)) throw Error('invalid_response');
        const items = data.sections.map((section) => ({
          value: section.name,
          label: section.label || section.name,
        }));
        for (const item of items)
          if (item.value !== 'nxt_direct')
            routeLabels.set(item.value, item.label);
        showDevices();
        options(route, [
          { value: 'inherit', label: 'По общим правилам' },
          { value: 'direct', label: 'Всегда напрямую' },
          ...items.filter(
            (item) => item.value !== 'direct' && item.value !== 'nxt_direct',
          ),
        ]);
        const capabilities = workflowContext(root).targets || [];
        options(
          gamingRoute,
          data.sections.flatMap((section) => {
            const eligibility = targetEligibility(
              {
                ...section,
                generated: capabilities.find(
                  (target) => target.name === section.name,
                )?.generated,
              },
              'route',
            );
            return eligibility.eligible
              ? [{ value: section.name, label: section.label || section.name }]
              : [];
          }),
        );
        showScope();
        routesUpdated = new Date().toLocaleString();
        routesFreshness.textContent = `Маршруты обновлены: ${routesUpdated}.`;
        if (announce) gamingResult.textContent = 'Маршруты обновлены.';
      })
      .catch(() => {
        if (generation === routesGeneration) routeError();
      });
  };
  const routeError = () =>
    (gamingResult.textContent = `Не удалось загрузить маршруты. Нажмите «Обновить маршруты».${routesUpdated ? ` Показаны данные от ${routesUpdated}.` : ''}`);
  if (area !== 'profiles') {
    void loadRoutes(initialRequest);
    // Keep entered addresses when route loading fails; retry only the read.
    group = route.closest('section')!;
    button('Обновить маршруты', gamingResult, async () => {
      await loadRoutes(request, true);
    });
  }
  root.addEventListener('forkop:refresh-tools', (event) => {
    const read =
      (event as CustomEvent<{ read?: Request }>).detail?.read || request;
    if (area !== 'profiles') {
      void loadDevices(read);
      void loadRoutes(read, true);
    }
    if (area !== 'devices') void loadProfiles(read);
  });
  return root;
}
