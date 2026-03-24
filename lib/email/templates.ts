// =========================================
// E-Mail HTML Templates
// Alle Templates geben vollständiges HTML zurück.
// =========================================

const DEFAULT_COLOR = "#059669"; // emerald-600

/**
 * Basis-HTML-Wrapper mit Moschee-Header und Footer.
 */
export function baseTemplate(
  content: string,
  mosqueName: string,
  accentColor = DEFAULT_COLOR
): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${mosqueName}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:${accentColor};border-radius:12px 12px 0 0;padding:24px 32px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${mosqueName}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="background:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:16px 32px;">
              <p style="margin:0;color:#6b7280;font-size:12px;text-align:center;">
                Diese E-Mail wurde von <strong>${mosqueName}</strong> über das Moschee-Portal gesendet.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// =========================================
// Newsletter
// =========================================

export function renderNewsletter(data: {
  mosqueName: string;
  bodyHtml: string;
  accentColor?: string;
}): string {
  return baseTemplate(data.bodyHtml, data.mosqueName, data.accentColor);
}

// =========================================
// Event-Bestätigung
// =========================================

export function renderEventConfirmation(data: {
  mosqueName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation?: string;
  registrantName?: string;
  accentColor?: string;
}): string {
  const content = `
    <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">Anmeldung bestätigt ✅</h2>
    <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
      ${data.registrantName ? `Hallo ${data.registrantName},` : "Hallo,"}<br/>
      Ihre Anmeldung zur folgenden Veranstaltung wurde erfolgreich registriert.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin:0 0 24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Veranstaltung</p>
          <p style="margin:0 0 16px;color:#111827;font-size:18px;font-weight:700;">${data.eventTitle}</p>

          <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Datum</p>
          <p style="margin:0 0 ${data.eventLocation ? "16px" : "0"};color:#374151;font-size:15px;">${data.eventDate}</p>

          ${data.eventLocation ? `
          <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Ort</p>
          <p style="margin:0;color:#374151;font-size:15px;">${data.eventLocation}</p>
          ` : ""}
        </td>
      </tr>
    </table>

    <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.5;">
      Wir freuen uns auf Ihre Teilnahme. Bei Fragen wenden Sie sich bitte direkt an ${data.mosqueName}.
    </p>
  `;
  return baseTemplate(content, data.mosqueName, data.accentColor);
}

// =========================================
// Spendenquittung
// =========================================

export function renderDonationReceipt(data: {
  mosqueName: string;
  donorName?: string;
  amountEur: string;
  donationDate: string;
  category?: string;
  accentColor?: string;
}): string {
  const content = `
    <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">Vielen Dank für Ihre Spende 🤲</h2>
    <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
      ${data.donorName ? `Assalamu Alaikum ${data.donorName},` : "Assalamu Alaikum,"}<br/>
      wir haben Ihre Spende erhalten und bestätigen Ihnen hiermit den Eingang.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin:0 0 24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 4px;color:#166534;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Spendenbetrag</p>
          <p style="margin:0 0 16px;color:#15803d;font-size:32px;font-weight:700;">${data.amountEur} €</p>

          <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Datum</p>
          <p style="margin:0 0 ${data.category ? "16px" : "0"};color:#374151;font-size:15px;">${data.donationDate}</p>

          ${data.category ? `
          <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Kategorie</p>
          <p style="margin:0;color:#374151;font-size:15px;">${data.category}</p>
          ` : ""}
        </td>
      </tr>
    </table>

    <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">
      Möge Allah Ihre Spende annehmen und Sie dafür reichlich belohnen. Jazakallahu khairan.
    </p>
    <p style="margin:8px 0 0;color:#6b7280;font-size:13px;">
      Für eine offizielle Spendenquittung (Steuerbescheinigung) wenden Sie sich bitte an ${data.mosqueName}.
    </p>
  `;
  return baseTemplate(content, data.mosqueName, data.accentColor);
}

// =========================================
// Gebühren-Mahnung (Madrasa)
// =========================================

export function renderFeeReminder(data: {
  mosqueName: string;
  parentName?: string;
  studentName: string;
  monthLabel: string;
  amountEur: string;
  paymentUrl?: string;
  accentColor?: string;
}): string {
  const btnColor = data.accentColor || DEFAULT_COLOR;
  const payButton = data.paymentUrl
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td align="center">
            <a href="${data.paymentUrl}" target="_blank" style="display:inline-block;background:${btnColor};color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
              Jetzt bezahlen
            </a>
          </td>
        </tr>
      </table>`
    : "";

  const content = `
    <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">Erinnerung: Offene Madrasa-Gebühr</h2>
    <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
      ${data.parentName ? `Sehr geehrte(r) ${data.parentName},` : "Sehr geehrte Eltern,"}<br/>
      wir möchten Sie freundlich daran erinnern, dass für Ihr Kind noch eine offene Gebühr besteht.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border-radius:8px;border:1px solid #fed7aa;margin:0 0 24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 4px;color:#c2410c;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Schüler/in</p>
          <p style="margin:0 0 16px;color:#111827;font-size:18px;font-weight:700;">${data.studentName}</p>

          <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Monat</p>
          <p style="margin:0 0 16px;color:#374151;font-size:15px;">${data.monthLabel}</p>

          <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Offener Betrag</p>
          <p style="margin:0;color:#c2410c;font-size:24px;font-weight:700;">${data.amountEur} €</p>
        </td>
      </tr>
    </table>

    ${payButton}

    <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">
      Bitte begleichen Sie die Gebühr so bald wie möglich. Bei Fragen oder Zahlungsschwierigkeiten
      wenden Sie sich bitte direkt an uns.
    </p>
    <p style="margin:8px 0 0;color:#374151;font-size:15px;">Vielen Dank und mit freundlichen Grüßen,</p>
    <p style="margin:4px 0 0;color:#374151;font-size:15px;font-weight:600;">${data.mosqueName}</p>
  `;
  return baseTemplate(content, data.mosqueName, data.accentColor);
}

// =========================================
// Jährliche Spendenbescheinigung per E-Mail
// =========================================

export function renderAnnualDonationReceipt(data: {
  mosqueName: string;
  mosqueAddress?: string;
  mosqueCity?: string;
  donorName: string;
  donorMembershipNumber?: string;
  year: number;
  donations: { amount_cents: number; paid_at: string; provider: string }[];
  totalCents: number;
  accentColor?: string;
}): string {
  function formatEuro(cents: number): string {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
  }
  function formatDate(dateStr: string): string {
    if (!dateStr) return "—";
    return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(dateStr));
  }
  function formatProvider(p: string): string {
    if (p === "stripe") return "Kreditkarte/SEPA";
    if (p === "paypal_link") return "PayPal";
    if (p === "manual") return "Barzahlung";
    return p;
  }

  const rows = data.donations.map((d, i) => `
    <tr>
      <td style="padding:8px 12px 8px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">${i + 1}</td>
      <td style="padding:8px 12px 8px 0;font-size:13px;border-bottom:1px solid #f3f4f6;">${formatDate(d.paid_at)}</td>
      <td style="padding:8px 12px 8px 0;font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6;">${formatProvider(d.provider)}</td>
      <td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #f3f4f6;">${formatEuro(d.amount_cents)}</td>
    </tr>
  `).join("");

  const accentHex = data.accentColor || DEFAULT_COLOR;
  const mosqueAddressLine = [data.mosqueAddress, data.mosqueCity].filter(Boolean).join(", ");

  const content = `
    <!-- Briefkopf -->
    <div style="margin:0 0 24px;padding-bottom:16px;border-bottom:2px solid ${accentHex};">
      <p style="margin:0 0 2px;color:#111827;font-size:18px;font-weight:700;">${data.mosqueName}</p>
      ${mosqueAddressLine ? `<p style="margin:0;color:#6b7280;font-size:13px;">${mosqueAddressLine}</p>` : ""}
    </div>

    <h2 style="margin:0 0 4px;color:#111827;font-size:22px;text-align:center;">Spendenbescheinigung</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;text-align:center;">für das Jahr ${data.year}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin:0 0 24px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 2px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Spender/in</p>
          <p style="margin:0 0 ${data.donorMembershipNumber ? "8px" : "0"};color:#111827;font-size:16px;font-weight:700;">${data.donorName}</p>
          ${data.donorMembershipNumber ? `<p style="margin:0;color:#6b7280;font-size:12px;">Mitgliedsnr.: ${data.donorMembershipNumber}</p>` : ""}
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      <thead>
        <tr>
          <th style="padding:0 12px 8px 0;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;font-weight:600;">Nr.</th>
          <th style="padding:0 12px 8px 0;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;font-weight:600;">Datum</th>
          <th style="padding:0 12px 8px 0;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;font-weight:600;">Zahlungsart</th>
          <th style="padding:0 0 8px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;font-weight:600;">Betrag</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding:12px 0 0;text-align:right;font-size:14px;font-weight:700;color:#111827;">Gesamtsumme ${data.year}:</td>
          <td style="padding:12px 0 0;text-align:right;font-size:18px;font-weight:700;color:#059669;">${formatEuro(data.totalCents)}</td>
        </tr>
      </tfoot>
    </table>

    <div style="margin:24px 0;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;">
      <p style="margin:0;font-size:12px;color:#92400e;line-height:1.6;">
        <strong>Hinweis:</strong> Diese Übersicht dient als Bestätigung Ihrer Spenden an ${data.mosqueName}.
        Bei Beträgen bis 300,00 EUR genügt als Nachweis der Kontoauszug zusammen mit dieser Bestätigung (§ 50 Abs. 4 EStDV).
      </p>
    </div>

    <!-- Unterschriften-Block -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
      <tr>
        <td style="vertical-align:bottom;">
          <p style="margin:0;font-size:13px;color:#374151;">Ausgestellt am: <strong>${formatDate(new Date().toISOString())}</strong></p>
        </td>
        <td style="text-align:right;vertical-align:bottom;">
          <div style="display:inline-block;text-align:center;">
            <div style="border-top:1px solid #9ca3af;width:200px;margin-bottom:4px;"></div>
            <p style="margin:0;font-size:12px;color:#6b7280;">${data.mosqueName}</p>
          </div>
        </td>
      </tr>
    </table>
  `;
  return baseTemplate(content, data.mosqueName, data.accentColor);
}

// =========================================
// Admin-Benachrichtigung
// =========================================

export function renderAdminNotification(data: {
  mosqueName: string;
  title: string;
  message: string;
  detailsUrl?: string;
  accentColor?: string;
}): string {
  const content = `
    <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">🔔 ${data.title}</h2>
    <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">${data.message}</p>

    ${data.detailsUrl ? `
    <p style="margin:0;">
      <a href="${data.detailsUrl}" style="display:inline-block;background:#059669;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Details ansehen →
      </a>
    </p>
    ` : ""}

    <p style="margin:${data.detailsUrl ? "24px" : "0"} 0 0;color:#9ca3af;font-size:13px;">
      Diese Benachrichtigung wurde automatisch vom Moschee-Portal gesendet.
    </p>
  `;
  return baseTemplate(content, data.mosqueName, data.accentColor);
}

// =========================================
// Gast-E-Mail-Verifizierung
// =========================================

export function renderGuestEventVerify(data: {
  mosqueName: string;
  eventTitle: string;
  verifyUrl: string;
  guestName?: string;
  accentColor?: string;
}): string {
  const content = `
    <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">E-Mail-Adresse bestätigen</h2>
    <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
      ${data.guestName ? `Hallo ${data.guestName},` : "Hallo,"}<br/>
      bitte bestätigen Sie Ihre E-Mail-Adresse um Ihre Anmeldung für
      <strong>${data.eventTitle}</strong> abzuschließen.
    </p>

    <p style="margin:0 0 24px;">
      <a href="${data.verifyUrl}" style="display:inline-block;background:#059669;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
        Anmeldung bestätigen →
      </a>
    </p>

    <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">
      Dieser Link ist 24 Stunden gültig. Falls Sie sich nicht angemeldet haben, können Sie diese E-Mail ignorieren.
    </p>
    <p style="margin:0;color:#9ca3af;font-size:12px;word-break:break-all;">
      Oder kopieren Sie diesen Link: ${data.verifyUrl}
    </p>
  `;
  return baseTemplate(content, data.mosqueName, data.accentColor);
}

// =========================================
// E-Mail-Adresse ändern — Bestätigung
// =========================================

export function renderEmailChangeConfirmation(data: {
  mosqueName: string;
  userName?: string;
  newEmail: string;
  confirmUrl: string;
  accentColor?: string;
}): string {
  const content = `
    <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">E-Mail-Adresse \u00e4ndern</h2>
    <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
      ${data.userName ? `Hallo ${data.userName},` : "Hallo,"}<br/>
      Sie haben beantragt, Ihre E-Mail-Adresse im Moschee-Portal zu \u00e4ndern.
      Bitte best\u00e4tigen Sie die neue Adresse, indem Sie den Button unten anklicken.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin:0 0 24px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Neue E-Mail-Adresse</p>
          <p style="margin:0;color:#111827;font-size:16px;font-weight:600;">${data.newEmail}</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px;">
      <a href="${data.confirmUrl}" style="display:inline-block;background:#059669;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
        E-Mail-Adresse best\u00e4tigen \u2192
      </a>
    </p>

    <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">
      Dieser Link ist 24 Stunden g\u00fcltig. Falls Sie diese \u00c4nderung nicht beantragt haben, k\u00f6nnen Sie diese E-Mail ignorieren \u2014 Ihre bisherige E-Mail-Adresse bleibt unver\u00e4ndert.
    </p>
    <p style="margin:0;color:#9ca3af;font-size:12px;word-break:break-all;">
      Oder kopieren Sie diesen Link: ${data.confirmUrl}
    </p>
  `;
  return baseTemplate(content, data.mosqueName, data.accentColor);
}

// =========================================
// Kontaktformular — Admin-Benachrichtigung
// =========================================

const INQUIRY_TYPE_LABELS: Record<string, string> = {
  demo: "Demo anfragen",
  support: "Support",
  partnership: "Kooperation",
  bug: "Fehlermeldung",
  feedback: "Feedback",
  other: "Sonstiges",
};

export function renderContactNotification(data: {
  name: string;
  email: string;
  organization?: string;
  inquiry_type: string;
  message: string;
  mosqueName?: string;
}): string {
  const typeLabel = INQUIRY_TYPE_LABELS[data.inquiry_type] ?? data.inquiry_type;
  const escapedMessage = data.message.replace(/\n/g, "<br/>");
  const senderName = data.mosqueName ?? "moschee.app";

  const content = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">📬 Neue Kontaktanfrage</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Eingegangen über das Kontaktformular auf ${senderName}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin:0 0 24px;">
      <tr>
        <td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:0 0 12px;">
                <p style="margin:0 0 2px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Name</p>
                <p style="margin:0;color:#111827;font-size:15px;font-weight:600;">${data.name}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 12px;">
                <p style="margin:0 0 2px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">E-Mail</p>
                <p style="margin:0;color:#111827;font-size:15px;">
                  <a href="mailto:${data.email}" style="color:#059669;text-decoration:none;">${data.email}</a>
                </p>
              </td>
            </tr>
            ${data.organization ? `
            <tr>
              <td style="padding:0 0 12px;">
                <p style="margin:0 0 2px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Organisation</p>
                <p style="margin:0;color:#111827;font-size:15px;">${data.organization}</p>
              </td>
            </tr>` : ""}
            <tr>
              <td>
                <p style="margin:0 0 2px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Anfragetyp</p>
                <p style="margin:0;color:#111827;font-size:15px;">
                  <span style="display:inline-block;background:#ecfdf5;color:#065f46;border-radius:4px;padding:2px 8px;font-size:13px;font-weight:600;">${typeLabel}</span>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Nachricht</p>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
      <p style="margin:0;color:#374151;font-size:15px;line-height:1.7;">${escapedMessage}</p>
    </div>

    <p style="margin:0 0 16px;">
      <a href="mailto:${data.email}" style="display:inline-block;background:#059669;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Direkt antworten →
      </a>
    </p>

    <p style="margin:0;color:#9ca3af;font-size:12px;">
      Diese Anfrage wurde automatisch gespeichert.
    </p>
  `;
  return baseTemplate(content, senderName);
}

// =========================================
// Kontaktformular — Auto-Reply an Absender
// =========================================

export function renderContactAutoReply(data: { name: string; mosqueName?: string }): string {
  const senderName = data.mosqueName ?? "moschee.app";
  const content = `
    <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">Vielen Dank für Ihre Anfrage ✅</h2>
    <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
      Hallo ${data.name},<br/><br/>
      wir haben Ihre Nachricht erhalten und werden uns in der Regel <strong>innerhalb von 24 Stunden</strong> bei Ihnen melden.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin:0 0 24px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0;color:#065f46;font-size:14px;line-height:1.6;">
            Diese Nachricht wurde über das Kontaktformular von <strong>${senderName}</strong> gesendet.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
      Mit freundlichen Grüßen,<br/>
      <strong>${senderName}</strong>
    </p>
  `;
  return baseTemplate(content, senderName);
}

// =========================================
// Förderpartner: Ablauf-Erinnerung an Moschee-Admin
// =========================================

export function renderSponsorExpiryReminder(data: {
  mosqueName: string;
  sponsorName: string;
  endDate: string;
  manageUrl: string;
  accentColor?: string;
}): string {
  const btnColor = data.accentColor || DEFAULT_COLOR;

  const content = `
    <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">Förderpartnerschaft läuft Ende des Monats ab</h2>
    <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
      Guten Tag,<br/>
      die Förderpartnerschaft mit dem folgenden Unternehmen läuft am Ende dieses Monats ab.
      Möchten Sie die Partnerschaft verlängern? Das geht jederzeit über den Admin-Bereich.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border-radius:8px;border:1px solid #fed7aa;margin:0 0 24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 4px;color:#c2410c;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Förderpartner</p>
          <p style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:700;">${data.sponsorName}</p>

          <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Läuft ab am</p>
          <p style="margin:0;color:#c2410c;font-size:18px;font-weight:600;">${data.endDate}</p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td align="center">
          <a href="${data.manageUrl}" target="_blank" style="display:inline-block;background:${btnColor};color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
            Förderpartner verwalten
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">
      Mit freundlichen Grüßen,<br/>
      <strong>${data.mosqueName} — Portal</strong>
    </p>
  `;
  return baseTemplate(content, data.mosqueName, data.accentColor);
}
