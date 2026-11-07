import { z } from "zod";

/**
 * The only module that reads process.env.
 * - publicConfig is validated on import and is safe in the browser.
 * - getServerConfig() holds secrets. It is validated at server startup
 *   (src/instrumentation.ts), so a bad value stops the app with a clear error.
 */

const bool = z.enum(["true", "false"]).transform((value) => value === "true");
const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM in 24-hour time");
const csv = z
  .string()
  .transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean));
const timezone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "must be a valid IANA timezone, e.g. Asia/Jakarta");

/** Treats `NAME=` (blank in .env or Vercel) the same as "not set". */
function withoutBlanks(env: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ""));
}

function parseEnv<T extends z.ZodType>(schema: T, env: Record<string, string | undefined>): z.output<T> {
  const result = schema.safeParse(withoutBlanks(env));
  if (result.success) return result.data;
  const problems = result.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${problems}`);
}

const publicSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("Memories"),
  NEXT_PUBLIC_ALLOW_GALLERY_UPLOAD: bool.default(false),
  NEXT_PUBLIC_CLIENT_MAX_EDGE_PX: z.coerce.number().int().min(320).default(2048),
  NEXT_PUBLIC_CLIENT_JPEG_QUALITY: z.coerce.number().gt(0).max(1).default(0.8),
  NEXT_PUBLIC_CLIENT_TARGET_MB: z.coerce.number().positive().default(1.5),
  NEXT_PUBLIC_GALLERY_POLL_SECONDS: z.coerce.number().min(1).default(10),
  NEXT_PUBLIC_VIDEO_MAX_SECONDS: z.coerce.number().int().positive().default(15),
  NEXT_PUBLIC_VIDEO_BITRATE_KBPS: z.coerce.number().int().positive().default(1800),
  NEXT_PUBLIC_VIDEO_MAX_EDGE_PX: z.coerce.number().int().min(320).default(1280),
  NEXT_PUBLIC_VIDEO_TARGET_MB: z.coerce.number().positive().default(3.6),
  NEXT_PUBLIC_REVIEW_VIDEO_BEFORE_UPLOAD: bool.default(false),
  NEXT_PUBLIC_IN_APP_PHOTO_CAMERA: bool.default(true),
  NEXT_PUBLIC_UPLOAD_CONCURRENCY: z.coerce.number().int().min(1).default(2),
  NEXT_PUBLIC_UPLOAD_RETRIES: z.coerce.number().int().min(0).default(3),
});

// NEXT_PUBLIC_ values are inlined at build time, so each must be named in full.
const publicEnv = parseEnv(publicSchema, {
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_ALLOW_GALLERY_UPLOAD: process.env.NEXT_PUBLIC_ALLOW_GALLERY_UPLOAD,
  NEXT_PUBLIC_CLIENT_MAX_EDGE_PX: process.env.NEXT_PUBLIC_CLIENT_MAX_EDGE_PX,
  NEXT_PUBLIC_CLIENT_JPEG_QUALITY: process.env.NEXT_PUBLIC_CLIENT_JPEG_QUALITY,
  NEXT_PUBLIC_CLIENT_TARGET_MB: process.env.NEXT_PUBLIC_CLIENT_TARGET_MB,
  NEXT_PUBLIC_GALLERY_POLL_SECONDS: process.env.NEXT_PUBLIC_GALLERY_POLL_SECONDS,
  NEXT_PUBLIC_VIDEO_MAX_SECONDS: process.env.NEXT_PUBLIC_VIDEO_MAX_SECONDS,
  NEXT_PUBLIC_VIDEO_BITRATE_KBPS: process.env.NEXT_PUBLIC_VIDEO_BITRATE_KBPS,
  NEXT_PUBLIC_VIDEO_MAX_EDGE_PX: process.env.NEXT_PUBLIC_VIDEO_MAX_EDGE_PX,
  NEXT_PUBLIC_VIDEO_TARGET_MB: process.env.NEXT_PUBLIC_VIDEO_TARGET_MB,
  NEXT_PUBLIC_REVIEW_VIDEO_BEFORE_UPLOAD: process.env.NEXT_PUBLIC_REVIEW_VIDEO_BEFORE_UPLOAD,
  NEXT_PUBLIC_IN_APP_PHOTO_CAMERA: process.env.NEXT_PUBLIC_IN_APP_PHOTO_CAMERA,
  NEXT_PUBLIC_UPLOAD_CONCURRENCY: process.env.NEXT_PUBLIC_UPLOAD_CONCURRENCY,
  NEXT_PUBLIC_UPLOAD_RETRIES: process.env.NEXT_PUBLIC_UPLOAD_RETRIES,
});

export const publicConfig = {
  appName: publicEnv.NEXT_PUBLIC_APP_NAME,
  allowGalleryUpload: publicEnv.NEXT_PUBLIC_ALLOW_GALLERY_UPLOAD,
  clientMaxEdgePx: publicEnv.NEXT_PUBLIC_CLIENT_MAX_EDGE_PX,
  clientJpegQuality: publicEnv.NEXT_PUBLIC_CLIENT_JPEG_QUALITY,
  clientTargetBytes: publicEnv.NEXT_PUBLIC_CLIENT_TARGET_MB * 1024 * 1024,
  galleryPollMs: publicEnv.NEXT_PUBLIC_GALLERY_POLL_SECONDS * 1000,
  videoMaxSeconds: publicEnv.NEXT_PUBLIC_VIDEO_MAX_SECONDS,
  videoBitsPerSecond: publicEnv.NEXT_PUBLIC_VIDEO_BITRATE_KBPS * 1000,
  videoMaxEdgePx: publicEnv.NEXT_PUBLIC_VIDEO_MAX_EDGE_PX,
  videoTargetBytes: publicEnv.NEXT_PUBLIC_VIDEO_TARGET_MB * 1024 * 1024,
  reviewVideoBeforeUpload: publicEnv.NEXT_PUBLIC_REVIEW_VIDEO_BEFORE_UPLOAD,
  inAppPhotoCamera: publicEnv.NEXT_PUBLIC_IN_APP_PHOTO_CAMERA,
  uploadConcurrency: publicEnv.NEXT_PUBLIC_UPLOAD_CONCURRENCY,
  uploadRetries: publicEnv.NEXT_PUBLIC_UPLOAD_RETRIES,
};

const serverSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    STORAGE_DRIVER: z.enum(["local", "webdav"]).optional(),
    LOCAL_STORAGE_DIR: z.string().default(".local-storage"),
    WEBDAV_URL: z.url().optional(),
    WEBDAV_USERNAME: z.string().optional(),
    WEBDAV_PASSWORD: z.string().optional(),
    WEBDAV_ROOT: z.string().default("/project__memories"),
    ADMIN_SECRET: z.string().min(16, "must be at least 16 characters"),
    APP_TIMEZONE: timezone.default("Asia/Jakarta"),
    MAX_PHOTOS_PER_GUEST_PER_DAY: z.coerce.number().int().positive().default(30),
    // 0 turns video off: the UI hides the button when the API reports a limit of 0.
    MAX_VIDEOS_PER_GUEST_PER_DAY: z.coerce.number().int().min(0).default(5),
    // Vercel rejects request bodies over ~4.5 MB, including multipart overhead.
    MAX_UPLOAD_MB: z.coerce.number().positive().max(4.4, "must stay under Vercel's 4.5 MB limit").default(4),
    MAX_GUEST_NAME_LENGTH: z.coerce.number().int().positive().default(40),
    ALLOWED_MIME_TYPES: csv.default(["image/jpeg", "image/webp"]),
    ALLOWED_VIDEO_MIME_TYPES: csv.default(["video/mp4", "video/webm"]),
    STORE_JPEG_QUALITY: z.coerce.number().int().min(1).max(100).default(85),
    THUMB_MAX_EDGE_PX: z.coerce.number().int().positive().default(400),
    THUMB_JPEG_QUALITY: z.coerce.number().int().min(1).max(100).default(70),
    STRIP_EXIF: bool.default(true),
    PHOTO_CACHE_SECONDS: z.coerce.number().int().min(0).default(86400),
    DAY_MODE: z.enum(["calendar", "event"]).default("calendar"),
    DAY_OPEN_TIME: clockTime.default("00:00"),
    DAY_CLOSE_TIME: clockTime.default("23:59"),
    GALLERY_AFTER_CLOSE: z.enum(["hidden", "readonly"]).default("hidden"),
    LOG_ENABLED: bool.default(true),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .transform((env) => ({
    ...env,
    // Local files don't exist on Vercel, so production defaults to the NAS.
    STORAGE_DRIVER: env.STORAGE_DRIVER ?? (env.NODE_ENV === "production" ? ("webdav" as const) : ("local" as const)),
  }))
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER !== "webdav") return;
    for (const key of ["WEBDAV_URL", "WEBDAV_USERNAME", "WEBDAV_PASSWORD"] as const) {
      if (!env[key]) {
        ctx.addIssue({ code: "custom", path: [key], message: "is required when STORAGE_DRIVER=webdav" });
      }
    }
  });

let serverConfig: z.output<typeof serverSchema> | undefined;

export function getServerConfig() {
  serverConfig ??= parseEnv(serverSchema, process.env);
  return serverConfig;
}
