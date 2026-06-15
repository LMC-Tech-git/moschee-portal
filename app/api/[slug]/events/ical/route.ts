// =========================================
// GET /api/[slug]/events/ical
// Öffentlicher iCal-Feed (kommende öffentliche Events) als .ics-Download.
// Kein cookies() → force-dynamic, mosque_id server-seitig via Slug.
// =========================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveMosqueBySlug } from "@/lib/resolve-mosque";
import { getPublicPublishedEvents } from "@/lib/actions/events";
import { getNextOccurrence } from "@/lib/recurrence";
import { buildEventsICS } from "@/lib/ical";
import type { Event } from "@/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const mosque = await resolveMosqueBySlug(params.slug);
  if (!mosque) {
    return NextResponse.json({ error: "Moschee nicht gefunden" }, { status: 404 });
  }

  const result = await getPublicPublishedEvents(mosque.id, 200);
  const all = result.success ? result.data || [] : [];

  const nowIso = new Date().toISOString();
  // Gleiche isPast-Logik wie app/[slug]/events/page.tsx:
  // wiederkehrend → nur vorbei wenn keine weitere Occurrence; sonst end_at-Vergleich.
  const upcoming = all.filter((e: Event) => {
    if (e.is_recurring) return getNextOccurrence(e) !== null;
    return !(e.end_at && e.end_at < nowIso);
  });

  const ics = buildEventsICS(upcoming, {
    tz: mosque.timezone || "Europe/Berlin",
    calName: mosque.name || "Veranstaltungen",
    slug: params.slug,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${params.slug}-events.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
