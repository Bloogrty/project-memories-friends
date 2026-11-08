import { getServerConfig, getServerTexts } from "@/config";
import { guestExists } from "./guests";
import { HttpError, requireDay } from "./http";
import { isGuestId } from "./validation";

const BYTES_PER_MB = 1024 * 1024;
// Multipart wrapping adds a little on top of the file itself.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

function tooLarge() {
  return new HttpError(413, getServerTexts().fileTooLarge(getServerConfig().MAX_UPLOAD_MB));
}

/** The checks every upload shares, up to and including reading the form. */
export async function readUploadForm(request: Request, code: string) {
  const t = getServerTexts();
  const day = await requireDay(code);
  if (day.status !== "open") {
    throw new HttpError(403, t.dayNotOpenForUploads, { code: "day_not_open" });
  }

  // Check the declared size first, to avoid reading an oversized body at all.
  const maxBytes = getServerConfig().MAX_UPLOAD_MB * BYTES_PER_MB;
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes + MULTIPART_OVERHEAD_BYTES) {
    throw tooLarge();
  }

  const form = await request.formData().catch(() => {
    throw new HttpError(400, t.expectedFile);
  });
  const guestId = form.get("guestId");
  if (typeof guestId !== "string") throw new HttpError(400, t.expectedFile);
  return { form, guestId };
}

export function requireFile(value: FormDataEntryValue | null, allowedTypes: string[]) {
  const t = getServerTexts();
  if (!(value instanceof File)) throw new HttpError(400, t.expectedFile);
  if (value.size > getServerConfig().MAX_UPLOAD_MB * BYTES_PER_MB) throw tooLarge();
  // Recorders report types like "video/webm;codecs=vp9", so compare the base type.
  if (!allowedTypes.includes(value.type.split(";")[0])) {
    throw new HttpError(415, t.fileTypeNotAllowed);
  }
  return value;
}

export async function requireGuest(code: string, guestId: string) {
  if (!isGuestId(guestId) || !(await guestExists(code, guestId))) {
    throw new HttpError(403, getServerTexts().joinAgain, { code: "unknown_guest" });
  }
}

export async function fileToBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer());
}

/** Limit messages say "today" in daily mode and "this event" in event mode. */
export function limitMessage(kind: "photo" | "video") {
  const t = getServerTexts();
  const daily = getServerConfig().SESSION_MODE === "daily";
  if (kind === "photo") return daily ? t.photoLimitToday : t.photoLimitEvent;
  return daily ? t.videoLimitToday : t.videoLimitEvent;
}
