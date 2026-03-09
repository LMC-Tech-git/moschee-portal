import { getAdminPB } from "@/lib/pocketbase-admin";
import { sendEmailDirect } from "./index";
import { renderAdminNotification } from "./templates";

/**
 * Sendet eine Benachrichtigungs-E-Mail an alle Admins einer Moschee.
 * Fehler werden nur geloggt, nie geworfen — darf den Hauptprozess nie blockieren.
 */
export async function notifyAdmins(params: {
  mosqueId: string;
  mosqueName: string;
  title: string;
  message: string;
  detailsUrl?: string;
  accentColor?: string;
}): Promise<void> {
  try {
    const pb = await getAdminPB();

    // Alle Admin-User der Moschee laden
    const admins = await pb.collection("users").getFullList({
      filter: `mosque_id = "${params.mosqueId}" && role = "admin"`,
      fields: "id,email,name",
    });

    if (admins.length === 0) return;

    const html = renderAdminNotification({
      mosqueName: params.mosqueName,
      title: params.title,
      message: params.message,
      detailsUrl: params.detailsUrl,
      accentColor: params.accentColor,
    });

    // An jeden Admin senden (parallel, Fehler isoliert)
    await Promise.allSettled(
      admins
        .filter((a) => !!a.email)
        .map((admin) =>
          sendEmailDirect({
            to: admin.email,
            subject: `[${params.mosqueName}] ${params.title}`,
            html,
          })
        )
    );
  } catch (err) {
    // Nie werfen — Admin-Benachrichtigung darf Hauptprozess nicht stören
    console.error("[notifyAdmins] Fehler:", err);
  }
}
