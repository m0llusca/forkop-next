export interface OverviewTraffic {
  downloadTotal: number;
  uploadTotal: number;
  connections: number;
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
  function stop() {
    epoch++;
    clearTimeout(timer);
    timer = undefined;
    previous = undefined;
  }
  async function refresh() {
    if (!read || !visible() || pending) return;
    clearTimeout(timer);
    timer = undefined;
    pending = true;
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
      const speed = valid
        ? `Скорость: приём ${Math.round((sample.downloadTotal - previous!.downloadTotal) / elapsed)} Б/с · отправка ${Math.round((sample.uploadTotal - previous!.uploadTotal) / elapsed)} Б/с`
        : 'Скорость ещё не измерена';
      output.textContent = `Получено: ${sample.downloadTotal} Б · Отправлено: ${sample.uploadTotal} Б · Соединений: ${sample.connections}. ${speed}. Счётчики контроллера с момента его запуска.`;
      previous = { ...sample, time };
    } catch {
      if (current === epoch && visible()) {
        previous = undefined;
        output.textContent =
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
