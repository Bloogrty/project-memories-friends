import { getServerConfig, getServerTexts } from "@/config";
import { HttpError, json, route } from "@/lib/http";
import { log } from "@/lib/logger";
import { countGuestVideos, InvalidMediaError, saveVideo } from "@/lib/photos";
import { fileToBuffer, limitMessage, readUploadForm, requireFile, requireGuest } from "@/lib/uploads";

export const POST = route<{ code: string }>(async (request, { code }) => {
  const config = getServerConfig();
  const { form, guestId } = await readUploadForm(request, code);
  const video = requireFile(form.get("video"), config.ALLOWED_VIDEO_MIME_TYPES);
  const poster = requireFile(form.get("poster"), config.ALLOWED_MIME_TYPES);
  await requireGuest(code, guestId);

  const video_limit = config.MAX_VIDEOS_PER_PERSON;
  const video_used = await countGuestVideos(code, guestId);
  if (video_used >= video_limit) {
    throw new HttpError(429, limitMessage("video"), {
      code: "video_quota_reached",
      video_used,
      video_limit,
    });
  }

  try {
    const id = await saveVideo(code, guestId, await fileToBuffer(video), await fileToBuffer(poster));
    log.info("video saved", { day: code, guest: guestId, bytes: video.size, type: video.type, used: video_used + 1, limit: video_limit });
    return json({ id, video_used: video_used + 1, video_limit }, 201);
  } catch (error) {
    if (error instanceof InvalidMediaError) {
      log.warn("video rejected", { day: code, guest: guestId, reason: error.message });
      throw new HttpError(415, getServerTexts().fileUnreadable);
    }
    throw error;
  }
});
