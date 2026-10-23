import { describe, it, expect } from 'vitest';
import { latestLatency } from '../latency';
describe('latency history presentation', () => {
  it('shows newest measurement and its actual timestamp regardless of array order', () => {
    expect(
      latestLatency([
        { time: '2026-10-23T09:00:00Z', delay: 120 },
        { time: '2026-10-23T10:00:00Z', delay: 54 },
      ]),
    ).toEqual({ latency: 54, latencyTestedAt: '2026-10-23T10:00:00Z' });
  });
  it('does not turn a newer failed check into an older successful latency', () => {
    expect(
      latestLatency([
        { time: '2026-10-23T09:00:00Z', delay: 120 },
        { time: '2026-10-23T10:00:00Z', delay: 0 },
      ]),
    ).toEqual({ latency: 0, latencyTestedAt: '2026-10-23T10:00:00Z' });
  });
  it('does not invent a timestamp for missing measurement history', () => {
    expect(latestLatency([])).toEqual({ latency: 0 });
  });
});

it('does not let a malformed older history entry hide a dated measurement', () => {
  expect(
    latestLatency([
      { time: 'invalid', delay: 900 },
      { time: '2026-10-23T10:00:00Z', delay: 54 },
    ]),
  ).toEqual({ latency: 54, latencyTestedAt: '2026-10-23T10:00:00Z' });
});
