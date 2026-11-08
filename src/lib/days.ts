import { getServerConfig } from "@/config";
import { readJson, writeJson } from "./storage";
import { wallClockParts, zonedTimeToUtcMs } from "./timezone";
import type { DayInfo, DayStatus } from "./types";
import { isDayCode } from "./validation";

/**
 * A "Day" is one album with its own link and upload window:
 * - daily mode: one per calendar date, code YYYY-MM-DD, times from DAY_OPEN_TIME / DAY_CLOSE_TIME.
 * - event mode: exactly one, code EVENT_CODE, times from EVENT_START / EVENT_END.
 */

/** Optional per-Day state at <day_code>/day.json, written when admin closes a Day early. */
interface DayFile {
  closed_at?: string;
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export function todayCode(now = Date.now()) {
  const p = wallClockParts(now, getServerConfig().APP_TIMEZONE);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** The code guests should land on from the home URL. */
export function currentCode() {
  const config = getServerConfig();
  return config.SESSION_MODE === "event" ? config.EVENT_CODE : todayCode();
}

function clockToMinutes(clock: string) {
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Daily Days use the code as their date. Returns null for anything that isn't a real date. */
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

/** Event mode has one Day. Its times are validated at startup, so they are set here. */
function eventWindow(code: string) {
  const config = getServerConfig();
  if (code !== config.EVENT_CODE || config.EVENT_START_MS === null || config.EVENT_END_MS === null) return null;
  return { opensAt: config.EVENT_START_MS, closesAt: config.EVENT_END_MS };
}

function dayFileKey(code: string) {
  return `${code}/day.json`;
}

/** Returns null when no such Day exists. */
export async function getDay(code: string, now = Date.now()): Promise<DayInfo | null> {
  if (!isDayCode(code)) return null;
  const config = getServerConfig();
  const window = config.SESSION_MODE === "event" ? eventWindow(code) : calendarWindow(code);
  if (!window) return null;

  // Closing a Day early through admin overrides the scheduled close.
  const file = await readJson<DayFile>(dayFileKey(code));
  const closedEarly = file?.closed_at ? Date.parse(file.closed_at) : Number.NaN;
  const closesAt = Number.isNaN(closedEarly) ? window.closesAt : Math.min(closedEarly, window.closesAt);

  const status: DayStatus = now >= closesAt ? "closed" : now < window.opensAt ? "upcoming" : "open";
  // Before an event starts, guests can already open the album and see when it starts.
  const visibleUpcoming = config.SESSION_MODE === "event";
  return {
    code,
    mode: config.SESSION_MODE,
    status,
    opens_at: new Date(window.opensAt).toISOString(),
    closes_at: new Date(closesAt).toISOString(),
    timezone: config.APP_TIMEZONE,
    gallery_visible:
      status === "open" ||
      (status === "upcoming" && visibleUpcoming) ||
      (status === "closed" && config.GALLERY_AFTER_CLOSE === "readonly"),
  };
}

export async function closeDay(code: string, now = Date.now()) {
  const file = await readJson<DayFile>(dayFileKey(code));
  await writeJson(dayFileKey(code), { ...file, closed_at: new Date(now).toISOString() });
}
