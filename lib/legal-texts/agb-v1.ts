import type { FrozenDocByLocale } from "./types";

// AGB v1 - no curly-quote chars in strings (SWC parser bug: U+201C treated as string terminator)
const AGB_V1: FrozenDocByLocale = {
  de: {
    title: "Allgemeine Geschäftsbedingungen (AGB)",
    effective: "2026-01-01",
    sections: [
      {
        heading: "1. Geltungsbereich",
        paragraphs: [
          "Diese AGB regeln die Nutzung des Moschee-Portals (nachfolgend: Portal) durch registrierte Nutzerinnen und Nutzer (Mitglieder einer angeschlossenen Gemeinde). Betreiber des Portals ist LMC Tech (nachfolgend: Betreiber).",
        ],
      },
      {
        heading: "2. Leistungsumfang",
        paragraphs: [
          "Das Portal stellt Mitgliedern Funktionen wie Gebetszeiten, Veranstaltungen, Beiträge, Spenden, Mitgliederverwaltung und ggf. einen Madrasa-Bereich bereit. Der konkrete Funktionsumfang richtet sich nach der jeweiligen Gemeinde und kann sich weiterentwickeln.",
        ],
      },
      {
        heading: "3. Registrierung und Zugang",
        paragraphs: [
          "Für die Nutzung geschützter Bereiche ist ein Nutzerkonto erforderlich. Die Angaben bei der Registrierung müssen wahrheitsgemäß sein. Zugangsdaten sind vertraulich zu behandeln. Der Betreiber bzw. die Gemeinde kann Konten bei Missbrauch sperren.",
        ],
      },
      {
        heading: "4. Datenschutz",
        paragraphs: [
          "Die Verarbeitung personenbezogener Daten richtet sich nach der Datenschutzerklärung ({link}). Verantwortlich für die Mitgliederdaten ist die jeweilige Gemeinde; der Betreiber handelt insoweit als Auftragsverarbeiter.",
        ],
        link: { label: "Datenschutzerklärung", href: "/datenschutz" },
      },
      {
        heading: "5. Spenden und Zahlungen",
        paragraphs: [
          "Spenden und Zahlungen werden über externe Zahlungsdienstleister (z. B. Stripe) abgewickelt. Es gelten zusätzlich deren Bedingungen. Der Betreiber ist nicht Vertragspartner der Spende selbst, sondern stellt die technische Abwicklung bereit.",
        ],
      },
      {
        heading: "6. Verfügbarkeit",
        paragraphs: [
          "Der Betreiber bemüht sich um eine hohe Verfügbarkeit, schuldet jedoch keine ununterbrochene Erreichbarkeit. Wartungsarbeiten, Störungen oder höhere Gewalt können zu vorübergehenden Einschränkungen führen.",
        ],
      },
      {
        heading: "7. Haftung",
        paragraphs: [
          "Der Betreiber haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper und Gesundheit. Bei einfacher Fahrlässigkeit haftet er nur bei Verletzung wesentlicher Vertragspflichten und begrenzt auf den vertragstypisch vorhersehbaren Schaden.",
        ],
      },
      {
        heading: "8. Änderungen und anwendbares Recht",
        paragraphs: [
          "Der Betreiber kann diese AGB mit Wirkung für die Zukunft ändern; geänderte Fassungen werden zur erneuten Zustimmung vorgelegt. Es gilt deutsches Recht.",
        ],
      },
    ],
  },
  tr: {
    title: "Genel Kullanım Koşulları (AGB)",
    notice: "Almanca metin bağlayıcıdır; bu Türkçe çeviri yalnızca kolaylık amaçlıdır.",
    effective: "2026-01-01",
    sections: [
      {
        heading: "1. Kapsam",
        paragraphs: [
          "Bu koşullar, Cami Portalı (Portal) kayıtlı kullanıcılar (bağlı bir cemaatin üyeleri) tarafından kullanımını düzenler. İşletmeci LMC Tech'tir.",
        ],
      },
      {
        heading: "2. Hizmet kapsamı",
        paragraphs: [
          "Portal; namaz vakitleri, etkinlikler, duyurular, bağışlar, üye yönetimi ve gerektiğinde bir Medrese alanı gibi işlevler sunar. Kapsam cemaate göre değişir ve geliştirilebilir.",
        ],
      },
      {
        heading: "3. Kayıt ve erişim",
        paragraphs: [
          "Korumalı alanlar için bir hesap gereklidir. Kayıt bilgileri doğru olmalı, giriş bilgileri gizli tutulmalıdır. Kötüye kullanımda hesap engellenebilir.",
        ],
      },
      {
        heading: "4. Veri koruması",
        paragraphs: [
          "Kişisel verilerin işlenmesi Gizlilik Politikası'na ({link}) tabidir. Üye verilerinden ilgili cemaat sorumludur; İşletmeci bu kapsamda veri işleyendir.",
        ],
        link: { label: "Gizlilik Politikası", href: "/datenschutz" },
      },
      {
        heading: "5. Bağışlar ve ödemeler",
        paragraphs: [
          "Bağış ve ödemeler harici ödeme sağlayıcıları (ör. Stripe) üzerinden yürütülür; onların koşulları da geçerlidir.",
        ],
      },
      {
        heading: "6. Erişilebilirlik",
        paragraphs: [
          "İşletmeci yüksek erişilebilirlik için çaba gösterir ancak kesintisiz erişimi garanti etmez.",
        ],
      },
      {
        heading: "7. Sorumluluk",
        paragraphs: [
          "İşletmeci kasıt ve ağır ihmalde ve can/sağlık ihlallerinde sınırsız; hafif ihmalde yalnızca esası yükümlülük ihlallerinde ve öngörülebilir zararla sınırlı sorumludur.",
        ],
      },
      {
        heading: "8. Değişiklikler ve uygulanacak hukuk",
        paragraphs: [
          "İşletmeci bu koşulları ileriye etkili değiştirebilir; değişen sürümler yeniden onaya sunulur. Alman hukuku geçerlidir.",
        ],
      },
    ],
  },
};

export default AGB_V1;
