import { z } from "zod";
import { getServerConfig } from "@/config";
import { createGuest, randomGuestName } from "@/lib/guests";
import { HttpError, json, requireDay, route } from "@/lib/http";
import { log } from "@/lib/logger";

export const POST = route<{ code: string }>(async (request, { code }) => {
  const day = await requireDay(code);
  if (day.status !== "open") throw new HttpError(403, "This Day isn't open.");

  const schema = z.object({
    name: z.string().trim().max(getServerConfig().MAX_GUEST_NAME_LENGTH).optional(),
  });
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) throw new HttpError(400, "That name is too long.");

  const name = body.data.name || randomGuestName();
  const id = await createGuest(code, name);
  log.info("guest joined", { day: code, guest: id });
  return json({ id, name }, 201);
});
