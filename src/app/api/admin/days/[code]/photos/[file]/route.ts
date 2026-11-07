import { HttpError, json, requireAdmin, requireDay, route } from "@/lib/http";
import { log } from "@/lib/logger";
import { deleteMedia } from "@/lib/photos";
import { parsePhotoFile, parseVideoFile } from "@/lib/validation";

export const DELETE = route<{ code: string; file: string }>(async (request, { code, file }) => {
  requireAdmin(request);
  await requireDay(code);
  if (!parsePhotoFile(file) && !parseVideoFile(file)) throw new HttpError(404, "File not found.");
  await deleteMedia(code, file);
  log.info("admin deleted file", { day: code, file });
  return json({ deleted: file });
});
