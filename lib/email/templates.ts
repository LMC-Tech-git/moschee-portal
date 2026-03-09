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
  accentColor?: string;
}): string {
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
