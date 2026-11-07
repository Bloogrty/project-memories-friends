import { getServerConfig } from "@/config";
import { guestExists } from "@/lib/guests";
import { HttpError, json, requireDay, route } from "@/lib/http";
import { countGuestPhotos, countGuestVideos } from "@/lib/photos";
import type { Quota } from "@/lib/types";
import { isGuestId } from "@/lib/validation";

export const GET = route<{ code: string; guestId: string }>(async (_request, { code, guestId }) => {
  await requireDay(code);
  if (!isGuestId(guestId) || !(await guestExists(code, guestId))) {
    throw new HttpError(404, "Guest not found.");
  }
  const config = getServerConfig();
  const [used, video_used] = await Promise.all([
    countGuestPhotos(code, guestId),
    countGuestVideos(code, guestId),
  ]);
  const quota: Quota = {
    used,
    limit: config.MAX_PHOTOS_PER_GUEST_PER_DAY,
    video_used,
    video_limit: config.MAX_VIDEOS_PER_GUEST_PER_DAY,
  };
  return json(quota);
});
