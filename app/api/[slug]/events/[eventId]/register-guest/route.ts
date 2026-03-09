import { NextResponse, type NextRequest } from "next/server";
import { resolveMosqueBySlug, resolveMosqueSettings } from "@/lib/resolve-mosque";
import { registerGuestForEvent } from "@/lib/actions/events";
import { guestRegistrationSchema } from "@/lib/validations";
import { checkRateLimit, hashIP, getRateLimitHeaders } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { sendEmailDirect } from "@/lib/email";
import { renderEventConfirmation, renderGuestEventVerify } from "@/lib/email/templates";
import { notifyAdmins } from "@/lib/email/notify-admin";

/**
 * POST /api/[slug]/events/[eventId]/register-guest
 * Gast-Registrierung für ein öffentliches Event.
 * Server-seitig: IP-Hash, Rate Limiting, Validierung.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; eventId: string } }
) {
  try {
    // 1. Moschee auflösen
    const mosque = await resolveMosqueBySlug(params.slug);
    if (!mosque) {
      return NextResponse.json(
        { success: false, error: "Moschee nicht gefunden" },
        { status: 404 }
      );
    }

    // 2. IP-basiertes Rate Limiting
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const ipHash = await hashIP(ip);
    const userAgent = request.headers.get("user-agent") || "";

    const rl = checkRateLimit(
      `guest-reg:${ipHash}`,
      10, // Max 10 Registrierungen pro IP pro Stunde
      60 * 60 * 1000
    );

    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    // 3. Body parsen und validieren
    const body = await request.json();
    const parsed = guestRegistrationSchema.safeParse({
      guest_name: body.guest_name,
      guest_email: body.guest_email,
      accept_privacy: true, // Client hat Checkbox akzeptiert
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Ungültige Eingabe";
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    // 3b. CAPTCHA (Turnstile) verifizieren
    const turnstileValid = await verifyTurnstileToken(body.turnstile_token || "");
    if (!turnstileValid) {
      return NextResponse.json(
        { success: false, error: "CAPTCHA-Verifizierung fehlgeschlagen. Bitte versuchen Sie es erneut." },
        { status: 400 }
      );
    }

    // 4. Registrierung durchführen (Server-seitig mit mosque_id)
    const result = await registerGuestForEvent(
      mosque.id,
      params.eventId,
      parsed.data.guest_name,
      parsed.data.guest_email,
      ipHash,
      userAgent
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // 5. E-Mail senden (asynchron, nicht blockierend)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    Promise.allSettled([
      // Event-Daten laden + E-Mail senden
      (async () => {
        try {
          const settings = await resolveMosqueSettings(mosque.id);
          const pb = await getAdminPB();
          const event = await pb.collection("events").getOne(params.eventId, {
            fields: "title,start_at,location_name",
          });

          const eventDate = event.start_at
            ? new Date(event.start_at).toLocaleDateString("de-DE", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })
            : "";

          // Wenn E-Mail-Verifizierung aktiv → Verify-Mail statt Bestätigung
          if (settings.guest_registration_email_verify && result.data?.verify_token) {
            const verifyUrl = `${baseUrl}/${params.slug}/events/${params.eventId}/verify?token=${result.data.verify_token}`;
            const html = renderGuestEventVerify({
              mosqueName: mosque.name,
              eventTitle: event.title,
              verifyUrl,
              guestName: parsed.data.guest_name,
              accentColor: mosque.brand_primary_color || undefined,
            });
            await sendEmailDirect({
              to: parsed.data.guest_email,
              subject: `Bitte bestätigen Sie Ihre Anmeldung: ${event.title}`,
              html,
            });
          } else {
            // Direkte Bestätigung
            const html = renderEventConfirmation({
              mosqueName: mosque.name,
              eventTitle: event.title,
              eventDate,
              eventLocation: event.location_name || undefined,
              registrantName: parsed.data.guest_name,
              accentColor: mosque.brand_primary_color || undefined,
            });
            await sendEmailDirect({
              to: parsed.data.guest_email,
              subject: `Anmeldung bestätigt: ${event.title}`,
              html,
            });
          }

          // Admin-Benachrichtigung
          const adminUrl = `${baseUrl}/admin/events/${params.eventId}`;
          await notifyAdmins({
            mosqueId: mosque.id,
            mosqueName: mosque.name,
            title: "Neue Gast-Anmeldung",
            message: `<strong>${parsed.data.guest_name}</strong> (${parsed.data.guest_email}) hat sich für <strong>${event.title}</strong> angemeldet.`,
            detailsUrl: adminUrl,
            accentColor: mosque.brand_primary_color || undefined,
          });
        } catch (e) {
          console.error("[Guest Registration] E-Mail-Fehler:", e);
        }
      })(),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Guest Registration] Fehler:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
