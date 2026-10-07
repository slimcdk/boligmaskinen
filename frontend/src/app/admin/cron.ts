/**
 * Just enough cron for the job list: five fields (minute hour day-of-month month day-of-week)
 * with numbers, "*", "*\/n" and comma lists, in local time.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function matches(field: string, value: number): boolean {
  if (field === '*') return true;
  return field.split(',').some((part) => {
    const every = /^\*\/(\d+)$/.exec(part);
    return every ? value % Number(every[1]) === 0 : Number(part) === value;
  });
}

const two = (n: number) => String(n).padStart(2, '0');

/** "Every day at 03:00", "Every Monday at 05:00", "Every 30 minutes" … or the expression itself. */
export function describeCron(cron: string): string {
  const [minute, hour, day, month, weekday] = cron.trim().split(/\s+/);
  const every = /^\*\/(\d+)$/.exec(minute);
  if (every && hour === '*' && day === '*' && month === '*' && weekday === '*') return `Every ${every[1]} minutes`;
  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) return cron;
  const at = `at ${two(Number(hour))}:${two(Number(minute))}`;
  if (day === '*' && month === '*' && weekday === '*') return `Every day ${at}`;
  if (day === '*' && month === '*' && /^\d$/.test(weekday)) return `Every ${DAYS[Number(weekday) % 7]} ${at}`;
  if (/^\d+$/.test(day) && month === '*' && weekday === '*') return `Day ${day} of every month ${at}`;
  if (/^\d+$/.test(day) && /^\d+$/.test(month) && weekday === '*') return `Every year on ${day} ${MONTHS[Number(month) - 1]} ${at}`;
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
export function relativeTime(date: Date, now: Date): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const ahead = seconds > 0;
  const size = Math.abs(seconds);
  const say = (n: number, unit: string) => {
    const text = `${n} ${unit}${n === 1 ? '' : 's'}`;
    return ahead ? `in ${text}` : `${text} ago`;
  };
  if (size < 45) return ahead ? 'in a moment' : 'just now';
  if (size < 3600) return say(Math.round(size / 60), 'minute');
  if (size < 86_400) return say(Math.round(size / 3600), 'hour');
  const days = Math.round(size / 86_400);
  if (days === 1) return ahead ? 'tomorrow' : 'yesterday';
  if (days < 45) return say(days, 'day');
  return say(Math.round(days / 30), 'month');
}

/** "2 min 38 s", "41 s". */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${seconds % 60 ? ` ${seconds % 60} s` : ''}`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** "495 MB", "13 kB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const units = ['kB', 'MB', 'GB', 'TB'];
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) { value /= 1000; unit++; }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
