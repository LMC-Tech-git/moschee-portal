import type { FrozenDocByLocale } from "./types";

/**
 * Datenschutzerklärung für Endnutzer, Version 1.
 * Rechtsgrundlage: Information/Kenntnisnahme (keine widerrufbare Einwilligung).
 */
const DATENSCHUTZ_V1: FrozenDocByLocale = {
  de: {
    title: "Datenschutzerklärung",
    effective: "2026-01-01",
    sections: [
      {
        heading: "1. Datenschutz auf einen Blick",
        paragraphs: [
          "Der Schutz Ihrer personenbezogenen Daten ist uns wichtig. Wir verarbeiten Ihre Daten ausschließlich auf Grundlage der gesetzlichen Bestimmungen (DSGVO, BDSG). Diese Erklärung informiert über Art, Umfang und Zweck der Verarbeitung im Moschee-Portal.",
        ],
      },
      {
        heading: "2. Verantwortliche Stelle",
        paragraphs: [
          "Für die Mitgliederdaten ist die jeweilige Gemeinde verantwortlich. Den technischen Betrieb erbringt LMC Tech als Auftragsverarbeiter. Kontakt: kontakt@lmctech.de.",
        ],
      },
      {
        heading: "3. Hosting und Infrastruktur",
        paragraphs: [
          "Das Portal wird bei der Hetzner Online GmbH in Deutschland gehostet. Server-Logfiles (z. B. anonymisierte/gehashte IP-Adresse, Zeitpunkt, abgerufene Ressource) werden zur Sicherstellung des Betriebs und der Sicherheit verarbeitet.",
        ],
      },
      {
        heading: "4. Erhobene Daten",
        paragraphs: ["Im Rahmen der Nutzung verarbeiten wir insbesondere:"],
        list: [
          "Stammdaten (Name, E-Mail, ggf. Mitgliedsnummer, Telefon, Adresse)",
          "Nutzungsdaten (Login, Veranstaltungs-Anmeldungen, Beiträge)",
          "Zahlungs- und Spendendaten (über den Zahlungsdienstleister)",
          "Technische Daten (gehashte IP, Zeitstempel, Geräteangaben)",
        ],
      },
      {
        heading: "5. Zahlungsabwicklung",
        paragraphs: [
          "Zahlungen werden über Stripe abgewickelt. Dabei werden die für die Zahlung erforderlichen Daten an Stripe übermittelt. Es gilt zusätzlich die Datenschutzerklärung von Stripe ({link}).",
        ],
        link: { label: "Stripe Datenschutz", href: "https://stripe.com/de/privacy" },
      },
      {
        heading: "6. Speicherdauer",
        paragraphs: [
          "Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke oder zur Erfüllung gesetzlicher Aufbewahrungspflichten erforderlich ist. Nachweise über Vertragsannahmen werden zur Erfüllung der Nachweispflicht über die Vertragslaufzeit hinaus aufbewahrt.",
        ],
      },
      {
        heading: "7. Ihre Rechte",
        paragraphs: [
          "Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Wenden Sie sich hierzu an kontakt@lmctech.de. Zudem besteht ein Beschwerderecht bei einer Aufsichtsbehörde.",
        ],
      },
      {
        heading: "8. KI-Dienste (Anthropic)",
        paragraphs: [
          "Soweit KI-gestützte Funktionen genutzt werden, kann der Anbieter Anthropic eingebunden sein. Eine Übermittlung erfolgt nur im erforderlichen Umfang und auf Grundlage geeigneter Garantien (EU-Standardvertragsklauseln). Weitere Informationen: {link}.",
        ],
        link: { label: "Anthropic Privacy", href: "https://www.anthropic.com/legal/privacy" },
      },
    ],
  },
  tr: {
    title: "Gizlilik Politikası",
    notice: "Almanca metin bağlayıcıdır; bu Türkçe çeviri yalnızca kolaylık amaçlıdır.",
    effective: "2026-01-01",
    sections: [
      {
        heading: "1. Genel bakış",
        paragraphs: [
          "Kişisel verilerinizin korunması bizim için önemlidir. Verilerinizi yalnızca yasal düzenlemeler (GDPR/DSGVO) çerçevesinde işleriz.",
        ],
      },
      {
        heading: "2. Sorumlu taraf",
        paragraphs: [
          "Üye verilerinden ilgili cemaat sorumludur. Teknik işletimi veri işleyen olarak LMC Tech sağlar. İletişim: kontakt@lmctech.de.",
        ],
      },
      {
        heading: "3. Barındırma ve altyapı",
        paragraphs: [
          "Portal Almanya'da Hetzner Online GmbH'de barındırılır. Sunucu kayıtları (ör. hash'lenmiş IP, zaman, kaynak) güvenlik ve işletim için işlenir.",
        ],
      },
      {
        heading: "4. İşlenen veriler",
        paragraphs: ["Kullanım kapsamında özellikle şunları işleriz:"],
        list: [
          "Ana veriler (ad, e-posta, üye no, telefon, adres)",
          "Kullanım verileri (giriş, etkinlik kayıtları, duyurular)",
          "Ödeme ve bağış verileri (ödeme sağlayıcı üzerinden)",
          "Teknik veriler (hash'lenmiş IP, zaman damgası, cihaz bilgisi)",
        ],
      },
      {
        heading: "5. Ödeme işlemleri",
        paragraphs: [
          "Ödemeler Stripe üzerinden yürütülür. Stripe'ın gizlilik politikası da geçerlidir ({link}).",
        ],
        link: { label: "Stripe Gizlilik", href: "https://stripe.com/de/privacy" },
      },
      {
        heading: "6. Saklama süresi",
        paragraphs: [
          "Verileri yalnızca gerekli olduğu sürece saklarız. Sözleşme onayına ilişkin kanıtlar, ispat yükümlülüğü için sözleşme süresinin ötesinde saklanır.",
        ],
      },
      {
        heading: "7. Haklarınız",
        paragraphs: [
          "Erişim, düzeltme, silme, kısıtlama, taşınabilirlik ve itiraz haklarına sahipsiniz: kontakt@lmctech.de. Ayrıca denetim makamına şikâyet hakkınız vardır.",
        ],
      },
      {
        heading: "8. Yapay zekâ hizmetleri (Anthropic)",
        paragraphs: [
          "YZ destekli işlevlerde Anthropic devreye girebilir. Aktarım yalnızca gerekli ölçüde ve uygun garantilerle (AB standart sözleşme maddeleri) yapılır: {link}.",
        ],
        link: { label: "Anthropic Privacy", href: "https://www.anthropic.com/legal/privacy" },
      },
    ],
  },
};

export default DATENSCHUTZ_V1;
