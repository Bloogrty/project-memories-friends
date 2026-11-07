import { getServerConfig } from "@/config";
import { todayCode } from "@/lib/days";

/** The home URL sends people to today's Day. Event mode has no "today", so it has no home page. */
export function GET() {
  if (getServerConfig().DAY_MODE !== "calendar") {
    return new Response("Open the link you were given to join a Day.", { status: 404 });
  }
  return new Response(null, {
    status: 307,
    headers: { Location: `/d/${todayCode()}`, "Cache-Control": "no-store" },
  });
}
