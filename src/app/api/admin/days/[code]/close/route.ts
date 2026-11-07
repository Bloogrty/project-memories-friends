import { closeDay } from "@/lib/days";
import { json, requireAdmin, requireDay, route } from "@/lib/http";
import { log } from "@/lib/logger";

export const POST = route<{ code: string }>(async (request, { code }) => {
  requireAdmin(request);
  await requireDay(code);
  await closeDay(code);
  log.info("admin closed day", { day: code });
  return json(await requireDay(code));
});
