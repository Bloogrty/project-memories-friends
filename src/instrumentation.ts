import { getClientConfig, getServerConfig, renamedVariablesInUse } from "@/config";
import { log } from "@/lib/logger";

/** Runs once when the server starts, so invalid env fails fast with a clear error. */
export function register() {
  const config = getServerConfig();
  getClientConfig();
  log.info("server started", {
    storage: config.STORAGE_DRIVER,
    session_mode: config.SESSION_MODE,
    ...(config.SESSION_MODE === "event" && {
      event_code: config.EVENT_CODE,
      event_start: new Date(config.EVENT_START_MS!).toISOString(),
      event_end: new Date(config.EVENT_END_MS!).toISOString(),
    }),
    timezone: config.APP_TIMEZONE,
    max_photos: config.MAX_PHOTOS_PER_PERSON,
    max_videos: config.MAX_VIDEOS_PER_PERSON,
    gallery_after_close: config.GALLERY_AFTER_CLOSE,
    log_level: config.LOG_LEVEL,
  });
  const renamed = renamedVariablesInUse();
  if (renamed.length > 0) {
    log.warn("old env variable names still work, but consider renaming them", { variables: renamed.join(", ") });
  }
}
