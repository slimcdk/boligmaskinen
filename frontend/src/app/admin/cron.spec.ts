import { describe, expect, it } from 'vitest';
import { describeCron, formatBytes, formatDuration, nextRun, relativeTime } from './cron';

describe('describeCron', () => {
  it('describes the schedules the jobs use', () => {
    expect(describeCron('0 3 * * *')).toBe('Every day at 03:00');
    expect(describeCron('0 5 * * 1')).toBe('Every Monday at 05:00');
    expect(describeCron('0 4 2 * *')).toBe('Day 2 of every month at 04:00');
    expect(describeCron('0 4 1 3 *')).toBe('Every year on 1 March at 04:00');
    expect(describeCron('*/30 * * * *')).toBe('Every 30 minutes');
    expect(describeCron('0 3 1-5 * *')).toBe('0 3 1-5 * *');
  });
});

describe('nextRun', () => {
  const from = new Date(2026, 9, 7, 15, 20); // Wednesday 7 October 2026, 15:20 local time

  it('finds the next time a schedule fires', () => {
    expect(nextRun('0 3 * * *', from)).toEqual(new Date(2026, 9, 8, 3, 0));
    expect(nextRun('30 15 * * *', from)).toEqual(new Date(2026, 9, 7, 15, 30));
    expect(nextRun('0 5 * * 1', from)).toEqual(new Date(2026, 9, 12, 5, 0));
    expect(nextRun('0 4 1 3 *', from)).toEqual(new Date(2027, 2, 1, 4, 0));
    expect(nextRun('*/30 * * * *', from)).toEqual(new Date(2026, 9, 7, 15, 30));
  });

  it('never returns the current minute', () => {
    expect(nextRun('20 15 * * *', from)).toEqual(new Date(2026, 9, 8, 15, 20));
  });
});

describe('formatting', () => {
  const now = new Date(2026, 9, 7, 12, 0);
  it('says how long ago or until', () => {
    expect(relativeTime(new Date(2026, 9, 7, 11, 57), now)).toBe('3 minutes ago');
    expect(relativeTime(new Date(2026, 9, 7, 17, 0), now)).toBe('in 5 hours');
    expect(relativeTime(new Date(2026, 9, 8, 12, 0), now)).toBe('tomorrow');
    expect(relativeTime(new Date(2026, 9, 7, 12, 0, 20), now)).toBe('in a moment');
  });

  it('writes durations and sizes', () => {
    expect(formatDuration(158_000)).toBe('2 min 38 s');
    expect(formatDuration(41_000)).toBe('41 s');
    expect(formatBytes(495_424_603)).toBe('495 MB');
    expect(formatBytes(13_454)).toBe('13 kB');
    expect(formatBytes(1_952_000)).toBe('2.0 MB');
  });
});
