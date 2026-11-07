import { json, requireAdmin, requireDay, route } from "@/lib/http";
import { listMedia } from "@/lib/photos";
import type { GalleryResponse } from "@/lib/types";

/** Same as the gallery, but still lists photos after the Day closes. */
export const GET = route<{ code: string }>(async (request, { code }) => {
  requireAdmin(request);
  const body: GalleryResponse = { day: await requireDay(code), photos: await listMedia(code) };
  return json(body);
});
