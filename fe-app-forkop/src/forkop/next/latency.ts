export function latestLatency(
  history: Array<{ time: string; delay: number }> = [],
): { latency: number; latencyTestedAt?: string } {
  const newest = history.reduce<{ time: string; delay: number } | undefined>(
    (best, item) =>
      !best ||
      (Number.isFinite(Date.parse(item.time)) &&
        (!Number.isFinite(Date.parse(best.time)) ||
          Date.parse(item.time) > Date.parse(best.time)))
        ? item
        : best,
    undefined,
  );
  if (!newest) return { latency: 0 };
  return {
    latency:
      Number.isFinite(newest.delay) && newest.delay > 0 ? newest.delay : 0,
    ...(Number.isFinite(Date.parse(newest.time))
      ? { latencyTestedAt: newest.time }
      : {}),
  };
}
