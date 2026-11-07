import { getServerConfig } from "@/config";
import { HttpError, json, requireDay, route } from "@/lib/http";
import { log } from "@/lib/logger";
import { countGuestPhotos, InvalidMediaError, listMedia, savePhoto } from "@/lib/photos";
import type { GalleryResponse } from "@/lib/types";
import { fileToBuffer, readUploadForm, requireFile, requireGuest } from "@/lib/uploads";

/** The gallery: photos and videos together. */
export const GET = route<{ code: string }>(async (_request, { code }) => {
  const day = await requireDay(code);
  const body: GalleryResponse = { day, photos: day.gallery_visible ? await listMedia(code) : [] };
  return json(body);
});

export const POST = route<{ code: string }>(async (request, { code }) => {
  const config = getServerConfig();
  const { form, guestId } = await readUploadForm(request, code);
  const photo = requireFile(form.get("photo"), config.ALLOWED_MIME_TYPES);
  await requireGuest(code, guestId);

  const limit = config.MAX_PHOTOS_PER_GUEST_PER_DAY;
  const used = await countGuestPhotos(code, guestId);
  if (used >= limit) {
    throw new HttpError(429, "You've reached today's photo limit.", { code: "quota_reached", used, limit });
  }

  try {
    const id = await savePhoto(code, guestId, await fileToBuffer(photo));
    log.info("photo saved", { day: code, guest: guestId, bytes: photo.size, used: used + 1, limit });
    return json({ id, used: used + 1, limit }, 201);
  } catch (error) {
    if (error instanceof InvalidMediaError) throw new HttpError(415, error.message);
    throw error;
  }
});
