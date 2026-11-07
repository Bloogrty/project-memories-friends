import { getServerConfig } from "@/config";
import { readJson, writeJson } from "./storage";
import type { DayInfo, DayStatus } from "./types";
import { isDayCode } from "./validation";

/** Optional per-Day settings at <day_code>/day.json. Required for event-mode Days. */
interface DayFile {
  opens_at?: string;
  closes_at?: string;
  closed_at?: string;
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function wallClockParts(utcMs: number, timeZone: string) {
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

/** Converts a wall-clock time in `timeZone` to UTC. Vercel runs in UTC, so this must be explicit. */
function zonedTimeToUtcMs(wallMs: number, timeZone: string) {
  const guess = wallMs - timeZoneOffsetMs(wallMs, timeZone);
  return wallMs - timeZoneOffsetMs(guess, timeZone);
}

export function todayCode(now = Date.now()) {
  const p = wallClockParts(now, getServerConfig().APP_TIMEZONE);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

function clockToMinutes(clock: string) {
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Calendar Days use the code as their date. Returns null for anything that isn't a real date. */
function calendarWindow(code: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(code);
  if (!match) return null;
  const midnight = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (new Date(midnight).toISOString().slice(0, 10) !== code) return null;

  const config = getServerConfig();
  const open = clockToMinutes(config.DAY_OPEN_TIME);
  const close = clockToMinutes(config.DAY_CLOSE_TIME);
  // A close time at or before the open time means the Day runs past midnight.
  const closeOffset = close <= open ? DAY_MS : 0;
  return {
    opensAt: zonedTimeToUtcMs(midnight + open * MINUTE_MS, config.APP_TIMEZONE),
    closesAt: zonedTimeToUtcMs(midnight + closeOffset + close * MINUTE_MS, config.APP_TIMEZONE),
  };
}

function dayFileKey(code: string) {
  return `${code}/day.json`;
}

/** Returns null when no such Day exists. */
export async function getDay(code: string, now = Date.now()): Promise<DayInfo | null> {
  if (!isDayCode(code)) return null;
  const config = getServerConfig();

  const window = config.DAY_MODE === "calendar" ? calendarWindow(code) : null;
  if (config.DAY_MODE === "calendar" && !window) return null;

  const file = await readJson<DayFile>(dayFileKey(code));
  const opensAt = window?.opensAt ?? Date.parse(file?.opens_at ?? "");
  const scheduledClose = window?.closesAt ?? Date.parse(file?.closes_at ?? "");
  if (Number.isNaN(opensAt) || Number.isNaN(scheduledClose)) return null;

  // Closing a Day early through admin overrides the scheduled close.
  const closedEarly = file?.closed_at ? Date.parse(file.closed_at) : Number.NaN;
  const closesAt = Number.isNaN(closedEarly) ? scheduledClose : Math.min(closedEarly, scheduledClose);

  const status: DayStatus = now >= closesAt ? "closed" : now < opensAt ? "upcoming" : "open";
  return {
    code,
    status,
    opens_at: new Date(opensAt).toISOString(),
    closes_at: new Date(closesAt).toISOString(),
    timezone: config.APP_TIMEZONE,
    gallery_visible: status === "open" || (status === "closed" && config.GALLERY_AFTER_CLOSE === "readonly"),
  };
}

export async function closeDay(code: string, now = Date.now()) {
  const file = await readJson<DayFile>(dayFileKey(code));
  await writeJson(dayFileKey(code), { ...file, closed_at: new Date(now).toISOString() });
}
