/**
 * Wall-clock time in a named timezone. Vercel runs in UTC, so every "day" or
 * event time must be converted explicitly. No server code: config.ts uses this.
 */

export function wallClockParts(utcMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function timeZoneOffsetMs(utcMs: number, timeZone: string) {
  const p = wallClockParts(utcMs, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(utcMs / 1000) * 1000;
}

/** Converts a wall-clock time in `timeZone` (given as if it were UTC) to real UTC. */
export function zonedTimeToUtcMs(wallMs: number, timeZone: string) {
  const guess = wallMs - timeZoneOffsetMs(wallMs, timeZone);
  return wallMs - timeZoneOffsetMs(guess, timeZone);
}

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const DATE_TIME_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Parses an ISO date-time. With an offset ("Z" or "+07:00") it is exact.
 * Without one, e.g. "2026-12-20T16:00", it is read as wall-clock time in
 * `timeZone`, which is what people mean when they type an event time.
 * Returns null for anything else, including impossible dates.
 */
export function parseDateTime(value: string, timeZone: string): number | null {
  const local = LOCAL_DATE_TIME.exec(value);
  if (local) {
    const [year, month, day, hour, minute, second] = local.slice(1).map((part) => Number(part ?? 0));
    const wall = Date.UTC(year, month - 1, day, hour, minute, second);
    const check = new Date(wall);
    if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) return null;
    return zonedTimeToUtcMs(wall, timeZone);
  }
  if (DATE_TIME_WITH_OFFSET.test(value)) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}
