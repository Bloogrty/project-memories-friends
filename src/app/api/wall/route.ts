import { getClientConfig } from "@/config";
import { currentCode } from "@/lib/days";
import { HttpError, json, requireDay, route, wallAllowed } from "@/lib/http";
import { listMedia } from "@/lib/photos";
import type { GalleryResponse } from "@/lib/types";

/**
 * The Live Wall's feed: the newest items of the current album. In daily mode
 * the album changes at midnight, so the wall follows without a reload.
 */
export const GET = route<object>(async (request) => {
  if (!wallAllowed(new URL(request.url).searchParams.get("key"))) {
    throw new HttpError(404, "Not found.");
  }
  const day = await requireDay(currentCode());
  const photos = day.gallery_visible ? (await listMedia(day.code)).slice(0, getClientConfig().wall.maxItems) : [];
  const body: GalleryResponse = { day, photos };
  return json(body);
});
