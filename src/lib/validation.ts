/**
 * Strict formats for anything that becomes part of a storage path.
 * These reject "..", slashes and similar, which is what prevents path traversal.
 *
 * Files are named <name>__<guest id>__<timestamp>_<random>, so the NAS folder
 * shows whose photo is whose. The name part is optional because files saved
 * before it was added have no name, and those guest IDs are full UUIDs.
 */
const DAY_CODE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const GUEST_ID = /^(?:[0-9a-f]{8}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const FILE_START = "^(?:[A-Za-z0-9-]{1,40}__)?([0-9a-f-]{8,36})__(\\d{13})_[0-9a-f]{12}";
const PHOTO_FILE = new RegExp(`${FILE_START}\\.jpg$`);
const VIDEO_FILE = new RegExp(`${FILE_START}\\.(mp4|webm)$`);

const FILE_NAME_MAX_LENGTH = 40;
const FILE_NAME_FALLBACK = "Guest";

export const isDayCode = (value: string) => DAY_CODE.test(value);
export const isGuestId = (value: string) => GUEST_ID.test(value);

export function parsePhotoFile(file: string) {
  const match = PHOTO_FILE.exec(file);
  if (!match || !isGuestId(match[1])) return null;
  return { guestId: match[1], timestamp: Number(match[2]) };
}

export function parseVideoFile(file: string) {
  const match = VIDEO_FILE.exec(file);
  if (!match || !isGuestId(match[1])) return null;
  return { guestId: match[1], timestamp: Number(match[2]), extension: match[3] as "mp4" | "webm" };
}

/** Makes a display name safe for a filename: "José  Ramos!" becomes "Jose-Ramos". */
export function fileSafeName(name: string | null | undefined) {
  const safe = (name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .slice(0, FILE_NAME_MAX_LENGTH)
    .replace(/^-+|-+$/g, "");
  return safe || FILE_NAME_FALLBACK;
}
