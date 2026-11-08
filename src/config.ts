import { z } from "zod";

/**
 * The only module that reads process.env. Server-side only: browser code gets
 * its settings through src/lib/client-config.tsx instead of importing this.
 *
 * - getClientConfig(): settings pages need in the browser. No secrets. The root
 *   layout reads them on the server and hands them to every page, so none of
 *   them need a NEXT_PUBLIC_ prefix.
 * - getServerConfig(): everything else, secrets included.
 *
 * Both are validated when the server starts (src/instrumentation.ts), so a bad
 * value stops the app with a clear error instead of misbehaving later.
 */

/**
 * Renamed variables: new name → old name. The old name keeps working, so an
 * existing deployment behaves the same without touching its env. When both are
 * set, the new name wins.
 */
const RENAMED: Record<string, string> = {
  ALLOW_GALLERY_UPLOAD: "NEXT_PUBLIC_ALLOW_GALLERY_UPLOAD",
  GALLERY_POLL_SECONDS: "NEXT_PUBLIC_GALLERY_POLL_SECONDS",
  VIDEO_MAX_SECONDS: "NEXT_PUBLIC_VIDEO_MAX_SECONDS",
  VIDEO_BITRATE_KBPS: "NEXT_PUBLIC_VIDEO_BITRATE_KBPS",
  VIDEO_MAX_EDGE_PX: "NEXT_PUBLIC_VIDEO_MAX_EDGE_PX",
  VIDEO_TARGET_MB: "NEXT_PUBLIC_VIDEO_TARGET_MB",
  REVIEW_VIDEO_BEFORE_UPLOAD: "NEXT_PUBLIC_REVIEW_VIDEO_BEFORE_UPLOAD",
  IN_APP_PHOTO_CAMERA: "NEXT_PUBLIC_IN_APP_PHOTO_CAMERA",
  UPLOAD_CONCURRENCY: "NEXT_PUBLIC_UPLOAD_CONCURRENCY",
  UPLOAD_RETRIES: "NEXT_PUBLIC_UPLOAD_RETRIES",
};

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

/** process.env with blanks removed (`NAME=` means "not set") and old names copied to new ones. */
function readEnv() {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && value !== "") env[key] = value;
  }
  for (const [current, old] of Object.entries(RENAMED)) {
    if (env[current] === undefined && env[old] !== undefined) env[current] = env[old];
  }
  return env;
}

function parseEnv<T extends z.ZodType>(schema: T): z.output<T> {
  const result = schema.safeParse(readEnv());
  if (result.success) return result.data;
  const problems = result.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${problems}`);
}

/** Old variable names that are set without their new name, for a startup warning. */
export function renamedVariablesInUse() {
  return Object.entries(RENAMED)
    .filter(([current, old]) => process.env[old] && !process.env[current])
    .map(([current, old]) => `${old} (now ${current})`);
}

// ---------- Settings the browser needs (no secrets) ----------

const clientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("Memories"),
  ALLOW_GALLERY_UPLOAD: bool.default(false),
  NEXT_PUBLIC_CLIENT_MAX_EDGE_PX: z.coerce.number().int().min(320).default(2048),
  NEXT_PUBLIC_CLIENT_JPEG_QUALITY: z.coerce.number().gt(0).max(1).default(0.8),
  NEXT_PUBLIC_CLIENT_TARGET_MB: z.coerce.number().positive().default(1.5),
  GALLERY_POLL_SECONDS: z.coerce.number().min(1).default(10),
  VIDEO_MAX_SECONDS: z.coerce.number().int().positive().default(15),
  VIDEO_BITRATE_KBPS: z.coerce.number().int().positive().default(1800),
  VIDEO_MAX_EDGE_PX: z.coerce.number().int().min(320).default(1280),
  VIDEO_TARGET_MB: z.coerce.number().positive().default(3.6),
  REVIEW_VIDEO_BEFORE_UPLOAD: bool.default(false),
  IN_APP_PHOTO_CAMERA: bool.default(true),
  UPLOAD_CONCURRENCY: z.coerce.number().int().min(1).default(2),
  UPLOAD_RETRIES: z.coerce.number().int().min(0).default(3),
});

function toClientConfig(env: z.output<typeof clientSchema>) {
  return {
    appName: env.NEXT_PUBLIC_APP_NAME,
    allowGalleryUpload: env.ALLOW_GALLERY_UPLOAD,
    image: {
      maxEdgePx: env.NEXT_PUBLIC_CLIENT_MAX_EDGE_PX,
      jpegQuality: env.NEXT_PUBLIC_CLIENT_JPEG_QUALITY,
      targetBytes: env.NEXT_PUBLIC_CLIENT_TARGET_MB * 1024 * 1024,
    },
    galleryPollMs: env.GALLERY_POLL_SECONDS * 1000,
    videoMaxSeconds: env.VIDEO_MAX_SECONDS,
    videoBitsPerSecond: env.VIDEO_BITRATE_KBPS * 1000,
    videoMaxEdgePx: env.VIDEO_MAX_EDGE_PX,
    videoTargetBytes: env.VIDEO_TARGET_MB * 1024 * 1024,
    reviewVideoBeforeUpload: env.REVIEW_VIDEO_BEFORE_UPLOAD,
    inAppPhotoCamera: env.IN_APP_PHOTO_CAMERA,
    uploadConcurrency: env.UPLOAD_CONCURRENCY,
    uploadRetries: env.UPLOAD_RETRIES,
  };
}

export type ClientConfig = ReturnType<typeof toClientConfig>;

let clientConfig: ClientConfig | undefined;

export function getClientConfig(): ClientConfig {
  clientConfig ??= toClientConfig(parseEnv(clientSchema));
  return clientConfig;
}

// ---------- Server-only settings (secrets live here) ----------

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
  serverConfig ??= parseEnv(serverSchema);
  return serverConfig;
}
