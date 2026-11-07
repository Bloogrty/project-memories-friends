import { json, requireDay, route } from "@/lib/http";

export const GET = route<{ code: string }>(async (_request, { code }) => {
  return json(await requireDay(code));
});
