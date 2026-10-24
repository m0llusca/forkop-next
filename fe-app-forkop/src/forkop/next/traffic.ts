export interface OverviewTraffic {
  downloadTotal: number;
  uploadTotal: number;
  connections: number;
}

const quantity = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
function bytes(value: number) {
  const units = ['Б', 'КиБ', 'МиБ', 'ГиБ', 'ТиБ'];
  const index =
    value > 0 ? Math.max(0, Math.min(4, Math.floor(Math.log2(value) / 10))) : 0;
  return `${quantity.format(value / 1024 ** index)} ${units[index]}`;
}

/** One request at a time, scheduled after completion, only for a visible view. */
export function createTrafficMonitor(
  output: HTMLElement,
  read: (() => Promise<OverviewTraffic | undefined>) | undefined,
  visible: () => boolean,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = false;
  let epoch = 0;
  let previous: (OverviewTraffic & { time: number }) | undefined;
  const list = document.createElement('dl');
  list.className = 'fkp-next-metrics';
  const fields = new Map<string, HTMLElement>();
  for (const [key, label] of [
    ['download-rate', 'Приём'],
    ['upload-rate', 'Отправка'],
    ['download-total', 'Получено'],
    ['upload-total', 'Отправлено'],
    ['connections', 'Соединений'],
  ]) {
    const group = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = label;
    const value = document.createElement('dd');
    value.dataset.metric = key;
    value.textContent = '—';
    group.append(term, value);
    list.append(group);
    fields.set(key, value);
  }
  const status = document.createElement('p');
  status.className = 'fkp-next-help fkp-next-traffic-status';
  status.setAttribute('role', 'status');
  status.textContent = 'Трафик пока недоступен.';
  output.replaceChildren(list, status);
  function readings(
    sample?: OverviewTraffic,
    download?: number,
    upload?: number,
  ) {
    fields.get('download-total')!.textContent = sample
      ? bytes(sample.downloadTotal)
      : '—';
    fields.get('upload-total')!.textContent = sample
      ? bytes(sample.uploadTotal)
      : '—';
    fields.get('connections')!.textContent = sample
      ? quantity.format(sample.connections)
      : '—';
    fields.get('download-rate')!.textContent =
      download === undefined ? '—' : `${bytes(download)}/с`;
    fields.get('upload-rate')!.textContent =
      upload === undefined ? '—' : `${bytes(upload)}/с`;
  }
  function stop() {
    epoch++;
    clearTimeout(timer);
    timer = undefined;
    previous = undefined;
    readings();
    status.textContent = 'Трафик ожидает обновления.';
  }
  async function refresh() {
    if (!read || !visible() || pending) return;
    clearTimeout(timer);
    timer = undefined;
    pending = true;
    if (!previous) status.textContent = 'Обновляем трафик…';
    const current = epoch;
    try {
      const sample = await read();
      if (current !== epoch || !visible()) return;
      if (
        !sample ||
        ![sample.downloadTotal, sample.uploadTotal, sample.connections].every(
          (v) => Number.isFinite(v) && v >= 0,
        ) ||
        !Number.isInteger(sample.connections)
      )
        throw new Error('invalid_traffic');
      const time = performance.now();
      const elapsed = previous ? (time - previous.time) / 1000 : 0;
      const valid =
        previous &&
        Number.isFinite(elapsed) &&
        elapsed > 0 &&
        sample.downloadTotal >= previous.downloadTotal &&
        sample.uploadTotal >= previous.uploadTotal;
      readings(
        sample,
        valid
          ? (sample.downloadTotal - previous!.downloadTotal) / elapsed
          : undefined,
        valid
          ? (sample.uploadTotal - previous!.uploadTotal) / elapsed
          : undefined,
      );
      status.textContent = `${valid ? '' : 'Скорость ещё не измерена. '}Счётчики контроллера с момента его запуска.`;
      previous = { ...sample, time };
    } catch {
      if (current === epoch && visible()) {
        previous = undefined;
        readings();
        status.textContent =
          'Трафик пока недоступен. Обновите данные или проверьте сервис.';
      }
    } finally {
      pending = false;
      if (visible())
        timer = setTimeout(() => {
          void refresh();
        }, 3000);
    }
  }
  return { refresh, stop };
}
