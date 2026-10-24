import { executeShellCommand } from '../../../helpers/executeShellCommand';
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
export function showComponentImpact(options: {
  component: string;
  action: string;
  currentVersion: string;
  latestVersion?: string;
  proceed: () => void;
  available: () => boolean;
}) {
  const root = document.createElement('div');
  const text = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    value: string,
  ) => {
    const node = document.createElement(tag);
    node.textContent = value;
    return node;
  };
  const result = text('div', 'Читаем сведения о текущей установке…');
  result.setAttribute('role', 'status');
  const start = text(
    'button',
    options.action === 'remove'
      ? 'Удалить после просмотра'
      : 'Установить после просмотра',
  );
  start.type = 'button';
  start.disabled = true;
  const cancel = text('button', 'Отмена');
  cancel.type = 'button';
  let active = true;
  cancel.onclick = () => {
    active = false;
    ui.hideModal();
  };
  start.onclick = () => {
    if (!active || start.disabled) return;
    if (!options.available()) {
      result.append(
        text(
          'p',
          'Состояние изменилось. Дождитесь завершения другой операции и откройте просмотр заново.',
        ),
      );
      start.disabled = true;
      return;
    }
    active = false;
    ui.hideModal();
    options.proceed();
  };
  root.append(result, cancel, start);
  ui.showModal('Влияние изменения компонента', root);
  void executeShellCommand({
    command: '/usr/bin/forkop',
    args: [
      'component_preview',
      JSON.stringify({ component: options.component, action: options.action }),
    ],
    timeout: 15000,
  })
    .then((response) => {
      if (!active) return;
      const parsed = object(JSON.parse(response.stdout));
      if ((response.code ?? 0) !== 0 || parsed.success !== true)
        throw Error('unavailable');
      const data = object(parsed.data),
        current = object(data.current),
        target = object(data.target),
        required = object(data.requirements);
      if (
        data.component !== options.component ||
        data.action !== options.action
      )
        throw Error('mismatched');
      const display = (value: unknown) =>
        typeof value === 'string' && value ? value : 'неизвестно';
      result.replaceChildren(
        text(
          'p',
          `Установлено: ${display(current.version || options.currentVersion)} → Цель: ${options.action === 'remove' ? 'удаление' : display(options.latestVersion)}. ${options.latestVersion ? 'Версия цели из проверки релиза ещё не подтверждает загруженный файл.' : 'Версия выбранной цели неизвестна: нет сведений, связанных с этим вариантом и источником.'}`,
        ),
        text(
          'p',
          `Вариант: ${display(current.variant)} → ${display(target.variant)} · Канал обновления: ${display(current.source)} → ${display(target.source)} · Допущенный источник бинарного файла: ${display(current.runtime_source)}`,
        ),
        text(
          'p',
          current.admission === 'admitted'
            ? `Текущее ядро допущено по точному SHA256: ${display(current.sha256)}`
            : 'Возможности текущего ядра не подтверждены точной идентичностью.',
        ),
        text(
          'p',
          'Возможности целевой сборки не подтверждены. Установщик проверит источник, контрольную сумму и конфигурацию до активации. Версия 3x-ui или Xray не заменяет сопоставление параметров и реальный тест.',
        ),
        text(
          'p',
          `Текущая сгенерированная конфигурация: REALITY ${required.reality ?? 'неизвестно'} · параметр record fragment ${required.record_fragment ?? 'неизвестно'}. Это требования файла, не подтверждение применённого трафика.`,
        ),
        text(
          'p',
          data.restart_expected === true
            ? 'Ожидается перезапуск: текущие соединения могут прерваться.'
            : 'Влияние на службу зависит от компонента; текущие задачи могут прерваться.',
        ),
        text(
          'p',
          data.recovery === 'sing_box_transaction'
            ? 'При ошибке установки ядра существующий установщик пытается восстановить локальные файлы и состояние варианта; для пакетов возможна повторная установка прежнего пакета. Восстановление базы пакетов и внешняя резервная копия не гарантируются.'
            : 'Автоматический откат этого компонента не подтверждён. Подготовьте резервную копию и прежний пакет для ручной повторной установки.',
        ),
        text(
          'p',
          'Сетевой результат: не проверялся. После операции проверьте службу, сопоставьте параметры подключения и запустите отдельный сетевой тест.',
        ),
      );
      const capabilities = object(current.capabilities);
      if (current.admission === 'admitted')
        result.append(
          text(
            'p',
            `Допущенные возможности: REALITY hybrid ${capabilities.reality_hybrid === true ? 'есть' : 'не подтверждено'} · REALITY record fragment ${capabilities.reality_record_fragment === true ? 'есть' : 'не подтверждено'}`,
          ),
        );
      start.disabled = false;
    })
    .catch(() => {
      if (active)
        result.textContent =
          'Не удалось прочитать влияние изменения. Закройте просмотр и повторите; установка не запускалась.';
    });
  return root;
}
