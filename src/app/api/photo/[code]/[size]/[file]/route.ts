import { getServerConfig } from "@/config";
import { getDay } from "@/lib/days";
import { HttpError, route } from "@/lib/http";
import { readMedia } from "@/lib/photos";
import { parsePhotoFile, parseVideoFile } from "@/lib/validation";

const VIDEO_TYPES = { mp4: "video/mp4", webm: "video/webm" };

/** Parses a single byte range. Returns "invalid" when it can't be satisfied. */
function parseRange(header: string, total: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return "invalid";
  const start = match[1] ? Number(match[1]) : Math.max(total - Number(match[2]), 0);
  const end = match[1] && match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
  return start > end || start >= total ? "invalid" : { start, end };
}

/** Serves media from the NAS, so its address and credentials never reach the browser. */
export const GET = route<{ code: string; size: string; file: string }>(async (request, { code, size, file }) => {
  const notFound = new HttpError(404, "File not found.");
  if (size !== "thumb" && size !== "full" && size !== "video") throw notFound;
  const video = size === "video" ? parseVideoFile(file) : null;
  if (size === "video" ? !video : !parsePhotoFile(file)) throw notFound;

  const day = await getDay(code);
  if (!day?.gallery_visible) throw notFound;

  const data = await readMedia(code, size, file);
  if (!data) throw notFound;

  const headers: Record<string, string> = {
    "Content-Type": video ? VIDEO_TYPES[video.extension] : "image/jpeg",
    "X-Content-Type-Options": "nosniff",
    // "private" keeps files in the viewer's browser only. A shared CDN copy
    // would keep serving them after a Day closes or a file is deleted.
    "Cache-Control": `private, max-age=${getServerConfig().PHOTO_CACHE_SECONDS}, immutable`,
  };
  if (!video) return new Response(new Uint8Array(data), { headers });

  // iPhones refuse to play a video unless the server supports byte ranges.
  headers["Accept-Ranges"] = "bytes";
  const rangeHeader = request.headers.get("range");
  if (!rangeHeader) return new Response(new Uint8Array(data), { headers });

  const range = parseRange(rangeHeader, data.length);
  if (range === "invalid") {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${data.length}` } });
  }
  headers["Content-Range"] = `bytes ${range.start}-${range.end}/${data.length}`;
  return new Response(new Uint8Array(data.subarray(range.start, range.end + 1)), { status: 206, headers });
});
