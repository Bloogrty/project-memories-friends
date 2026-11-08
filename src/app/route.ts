import { currentCode } from "@/lib/days";

/** The home URL sends people to the current album: today's in daily mode, the event's in event mode. */
export function GET() {
  return new Response(null, {
    status: 307,
    headers: { Location: `/d/${currentCode()}`, "Cache-Control": "no-store" },
  });
}
