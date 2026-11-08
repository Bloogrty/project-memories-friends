import { createHash, timingSafeEqual } from "node:crypto";
import { getServerConfig, getServerTexts } from "@/config";
import { getDay } from "./days";
import { log } from "./logger";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Wraps a route handler so thrown errors become clean JSON, details stay in the
 * logs, and every request gets one log line. Gallery polling and image loads are
 * constant, so successful reads only show at debug level.
 */
export function route<Params>(
  handler: (request: Request, params: Params) => Promise<Response>,
) {
  return async (request: Request, context: { params: Promise<Params> }) => {
    const startedAt = Date.now();
    const fields = { method: request.method, path: new URL(request.url).pathname };
    const done = (status: number) => ({ ...fields, status, ms: Date.now() - startedAt });
    try {
      const response = await handler(request, await context.params);
      const line = done(response.status);
      if (response.status >= 400) log.warn("request", line);
      else if (request.method === "GET") log.debug("request", line);
      else log.info("request", line);
      return response;
    } catch (error) {
      if (error instanceof HttpError) {
        log.warn("request", { ...done(error.status), reason: error.message });
        return json({ error: error.message, ...error.extra }, error.status);
      }
      log.error("request failed", done(500), error);
      return json({ error: serverErrorText() }, 500);
    }
  };
}

/** Must never throw itself: it reports errors, which may include a bad config. */
function serverErrorText() {
  try {
    return getServerTexts().serverError;
  } catch {
    return "Something went wrong on the server. Please try again.";
  }
}

export async function requireDay(code: string) {
  const day = await getDay(code);
  if (!day) throw new HttpError(404, getServerTexts().dayNotFound);
  return day;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function requireAdmin(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  // Hashing gives equal lengths, which timingSafeEqual requires.
  if (!timingSafeEqual(digest(supplied), digest(getServerConfig().ADMIN_SECRET))) {
    throw new HttpError(401, "Wrong admin secret.");
  }
}
