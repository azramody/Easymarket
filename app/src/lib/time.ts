// Helpers for "ready by 7am Eastern" regardless of the phone's own time zone.
export const NOTIFY_TZ = 'America/New_York';
export const NOTIFY_HOUR = 7;

function tzOffsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return Math.round((asUTC - at.getTime()) / 60000);
}

/** The phone-local hour/minute that equals 7:00 in New York today. */
export function localTimeFor(hourInTz: number, tz = NOTIFY_TZ, now = new Date()): { hour: number; minute: number } {
  const diff = tzOffsetMinutes(tz, now) - -now.getTimezoneOffset(); // tz offset minus local offset
  let total = hourInTz * 60 - diff;
  total = ((total % 1440) + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

/** Today's date in New York as YYYY-MM-DD (episodes are dated in Eastern time). */
export function todayInNY(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: NOTIFY_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function formatDuration(sec: number): string {
  const m = Math.round(sec / 60);
  return m < 1 ? '<1 min' : `${m} min`;
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
