import { fill } from '@boligmaskinen/engine';

/**
 * Just enough cron for the job list: five fields (minute hour day-of-month month day-of-week)
 * with numbers, "*", "*\/n" and comma lists, in local time.
 */

/** The words for schedules and times in a language: English here, Danish in da.json (time). */
export interface TimeWords {
  /** Writes the names of days and months, times ago and dates. */
  locale: string;
  everyMinutes: string;
  everyDay: string;
  everyWeekday: string;
  monthly: string;
  yearly: string;
  justNow: string;
  inAMoment: string;
  /** The unit of hours in a duration. */
  hours: string;
}

export const ENGLISH_TIME: TimeWords = {
  locale: 'en-GB',
  everyMinutes: 'Every {{ n }} minutes',
  everyDay: 'Every day at {{ time }}',
  everyWeekday: 'Every {{ day }} at {{ time }}',
  monthly: 'Day {{ day }} of every month at {{ time }}',
  yearly: 'Every year on {{ date }} at {{ time }}',
  justNow: 'just now',
  inAMoment: 'in a moment',
  hours: 'h',
};

function matches(field: string, value: number): boolean {
  if (field === '*') return true;
  return field.split(',').some((part) => {
    const every = /^\*\/(\d+)$/.exec(part);
    return every ? value % Number(every[1]) === 0 : Number(part) === value;
  });
}

const two = (n: number) => String(n).padStart(2, '0');

/** "Every day at 03:00", "Every Monday at 05:00", "Every 30 minutes" … or the expression itself. */
export function describeCron(cron: string, words: TimeWords = ENGLISH_TIME): string {
  const [minute, hour, day, month, weekday] = cron.trim().split(/\s+/);
  const every = /^\*\/(\d+)$/.exec(minute);
  if (every && hour === '*' && day === '*' && month === '*' && weekday === '*') return fill(words.everyMinutes, { n: every[1] });
  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) return cron;
  const time = `${two(Number(hour))}:${two(Number(minute))}`;
  if (day === '*' && month === '*' && weekday === '*') return fill(words.everyDay, { time });
  if (day === '*' && month === '*' && /^\d$/.test(weekday)) {
    // 4 January 2026 was a Sunday, day 0
    const name = new Date(2026, 0, 4 + (Number(weekday) % 7)).toLocaleDateString(words.locale, { weekday: 'long' });
    return fill(words.everyWeekday, { day: name, time });
  }
  if (/^\d+$/.test(day) && month === '*' && weekday === '*') return fill(words.monthly, { day, time });
  if (/^\d+$/.test(day) && /^\d+$/.test(month) && weekday === '*') {
    const date = new Date(2026, Number(month) - 1, Number(day)).toLocaleDateString(words.locale, { day: 'numeric', month: 'long' });
    return fill(words.yearly, { date, time });
  }
  return cron;
}

/** The next time the expression fires after `from`, or null within the next two years. */
export function nextRun(cron: string, from: Date): Date | null {
  const [minute, hour, day, month, weekday] = cron.trim().split(/\s+/);
  const start = new Date(from.getTime());
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);
  for (let d = 0; d < 732; d++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d);
    if (!matches(day, date.getDate()) || !matches(month, date.getMonth() + 1) || !matches(weekday, date.getDay())) continue;
    for (let h = 0; h < 24; h++) {
      if (!matches(hour, h)) continue;
      for (let m = 0; m < 60; m++) {
        if (!matches(minute, m)) continue;
        const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
        if (candidate >= start) return candidate;
      }
    }
  }
  return null;
}

/** "3 minutes ago", "in 5 hours", "yesterday", "in 4 days". */
export function relativeTime(date: Date, now: Date, words: TimeWords = ENGLISH_TIME): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const ahead = seconds > 0;
  const size = Math.abs(seconds);
  const sign = ahead ? 1 : -1;
  const say = new Intl.RelativeTimeFormat(words.locale, { numeric: 'auto' });
  if (size < 45) return ahead ? words.inAMoment : words.justNow;
  if (size < 3600) return say.format(sign * Math.round(size / 60), 'minute');
  if (size < 86_400) return say.format(sign * Math.round(size / 3600), 'hour');
  const days = Math.round(size / 86_400);
  if (days < 45) return say.format(sign * days, 'day');
  return say.format(sign * Math.round(days / 30), 'month');
}

/** "2 min 38 s", "41 s". */
export function formatDuration(milliseconds: number, words: TimeWords = ENGLISH_TIME): string {
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${seconds % 60 ? ` ${seconds % 60} s` : ''}`;
  return `${Math.floor(minutes / 60)} ${words.hours} ${minutes % 60} min`;
}

/** "495 MB", "13 kB". */
export function formatBytes(bytes: number, words: TimeWords = ENGLISH_TIME): string {
  if (bytes < 1000) return `${bytes} B`;
  const units = ['kB', 'MB', 'GB', 'TB'];
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) { value /= 1000; unit++; }
  const digits = value < 10 ? 1 : 0;
  return `${value.toLocaleString(words.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false })} ${units[unit]}`;
}
