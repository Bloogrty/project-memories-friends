import { getServerConfig } from "@/config";
import { log } from "@/lib/logger";

/** Runs once when the server starts, so invalid env fails fast with a clear error. */
export function register() {
  const config = getServerConfig();
  log.info("server started", {
    storage: config.STORAGE_DRIVER,
    day_mode: config.DAY_MODE,
    timezone: config.APP_TIMEZONE,
    max_photos: config.MAX_PHOTOS_PER_GUEST_PER_DAY,
    max_videos: config.MAX_VIDEOS_PER_GUEST_PER_DAY,
    gallery_after_close: config.GALLERY_AFTER_CLOSE,
    log_level: config.LOG_LEVEL,
  });
}
