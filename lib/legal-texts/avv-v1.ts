import type { FrozenDocByLocale } from "./types";

// AVV v1 - no curly-quote chars in strings (SWC parser bug: U+201C treated as string terminator)
const AVV_V1: FrozenDocByLocale = {
  de: {
    title: "Auftragsverarbeitungsvertrag (AVV)",
    notice:
      "ENTWURF nach Art. 28 DSGVO - vor Produktiveinsatz anwaltlich prüfen lassen. Wirksam mit der digitalen Bestätigung durch eine vertretungsberechtigte Person der Gemeinde.",
    effective: "2026-01-01",
    sections: [
      {
        heading: "1. Gegenstand, Art, Zweck und Dauer",
        paragraphs: [
          "Die Gemeinde (nachfolgend: Verantwortlicher) beauftragt LMC Tech (nachfolgend: Auftragsverarbeiter) mit der Verarbeitung personenbezogener Daten im Rahmen des Betriebs des Moschee-Portals. Gegenstand sind die zur Bereitstellung der gebuchten Module erforderlichen Verarbeitungen. Die Dauer entspricht der Laufzeit der Nutzungsvereinbarung.",
        ],
      },
      {
        heading: "2. Art der Daten und Kategorien betroffener Personen",
        paragraphs: ["Verarbeitet werden insbesondere:"],
        list: [
          "Stammdaten (Name, E-Mail, Mitgliedsnummer, ggf. Telefon/Adresse)",
          "Nutzungs- und Inhaltsdaten (Logins, Anmeldungen, Beiträge)",
          "Zahlungs-/Spendendaten (Beträge, Status; Zahlungsdetails beim Zahlungsdienstleister)",
          "Betroffene: Mitglieder, Eltern/Schüler (Madrasa), Spender, Administratoren",
        ],
      },
      {
        heading: "3. Weisungsgebundenheit",
        paragraphs: [
          "Der Auftragsverarbeiter verarbeitet personenbezogene Daten ausschließlich auf dokumentierte Weisung des Verantwortlichen, einschließlich der Übermittlung in Drittländer, sofern nicht eine gesetzliche Verpflichtung besteht. Ist der Auftragsverarbeiter der Auffassung, dass eine Weisung gegen die DSGVO oder andere Datenschutzvorschriften verstößt, informiert er den Verantwortlichen unverzüglich (Art. 28 Abs. 3 S. 2 DSGVO).",
        ],
      },
      {
        heading: "4. Vertraulichkeit",
        paragraphs: [
          "Der Auftragsverarbeiter stellt sicher, dass die zur Verarbeitung befugten Personen zur Vertraulichkeit verpflichtet sind oder einer angemessenen gesetzlichen Verschwiegenheitspflicht unterliegen.",
        ],
      },
      {
        heading: "5. Technische und organisatorische Maßnahmen (TOMs)",
        paragraphs: [
          "Der Auftragsverarbeiter trifft die nach Art. 32 DSGVO erforderlichen technischen und organisatorischen Maßnahmen (TOMs). Diese sind in der Anlage TOMs beschrieben und umfassen u. a. Verschlüsselung der Übertragung (TLS), Zugriffskontrolle, gehashte IP-Speicherung, Rate-Limiting, Backups mit Rotation sowie Mandantentrennung (mosque_id).",
        ],
      },
      {
        heading: "6. Unterauftragsverarbeiter",
        paragraphs: [
          "Der Verantwortliche stimmt dem Einsatz folgender Unterauftragsverarbeiter zu. Der Auftragsverarbeiter informiert über beabsichtigte Änderungen und räumt ein Widerspruchsrecht ein:",
        ],
        list: [
          "Hetzner Online GmbH (Hosting, Deutschland)",
          "Stripe Payments Europe Ltd. (Zahlungsabwicklung)",
          "Resend (E-Mail-Versand)",
          "Anthropic (KI-gestützte Funktionen, auf Basis von EU-Standardvertragsklauseln)",
        ],
      },
      {
        heading: "7. Unterstützung des Verantwortlichen",
        paragraphs: [
          "Der Auftragsverarbeiter unterstützt den Verantwortlichen im angemessenen Umfang bei der Erfüllung der Betroffenenrechte (Art. 12-22), bei der Meldung von Datenschutzverletzungen (Art. 33/34) sowie bei Datenschutz-Folgenabschätzungen und vorheriger Konsultation (Art. 35/36). Von Datenpannen, die personenbezogene Daten des Verantwortlichen betreffen, unterrichtet er den Verantwortlichen unverzüglich.",
        ],
      },
      {
        heading: "8. Löschung und Rückgabe",
        paragraphs: [
          "Nach Abschluss der Verarbeitung löscht der Auftragsverarbeiter nach Wahl des Verantwortlichen alle personenbezogenen Daten oder gibt sie zurück, sofern keine gesetzliche Aufbewahrungspflicht besteht. Nachweise über Vertragsannahmen können zur Erfüllung der Nachweispflicht gesondert aufbewahrt werden.",
        ],
      },
      {
        heading: "9. Nachweise und Kontrollen (Auditrecht)",
        paragraphs: [
          "Der Auftragsverarbeiter stellt dem Verantwortlichen alle erforderlichen Informationen zum Nachweis der Einhaltung der Pflichten aus Art. 28 DSGVO zur Verfügung und ermöglicht Überprüfungen - einschließlich Inspektionen - in angemessenem Umfang, mit angemessener Vorankündigung und ohne unverhältnismäßige Beeinträchtigung des Betriebs.",
        ],
      },
      {
        heading: "10. Haftung",
        paragraphs: [
          "Die Haftung im Verhältnis der Parteien richtet sich nach Art. 82 DSGVO und der Nutzungsvereinbarung. Im Außenverhältnis gegenüber betroffenen Personen gelten die gesetzlichen Bestimmungen.",
        ],
      },
      {
        heading: "11. Schlussbestimmungen",
        paragraphs: [
          "Es gilt deutsches Recht. Maßgeblich ist die deutsche Fassung; Übersetzungen sind unverbindlich. Bei Widersprüchen zwischen diesem AVV und der Nutzungsvereinbarung gehen in Datenschutzfragen die Regelungen dieses AVV vor.",
        ],
      },
    ],
  },
  tr: {
    title: "Veri İşleme Sözleşmesi (AVV)",
    notice:
      "GDPR Madde 28 kapsamında TASLAK - yürürlükten önce hukuken incelenmelidir. Almanca metin bağlayıcıdır; Türkçe çeviri yalnızca kolaylık amaçlıdır.",
    effective: "2026-01-01",
    sections: [
      {
        heading: "1. Konu, niteliği, amacı ve süresi",
        paragraphs: [
          "Cemaat (Veri Sorumlusu), LMC Tech'i (Veri İşleyen) Cami Portalı'nın işletimi kapsamında kişisel verileri işlemekle görevlendirir. Süre, Kullanım Sözleşmesi süresine eşittir.",
        ],
      },
      {
        heading: "2. Veri türleri ve ilgili kişi kategorileri",
        paragraphs: ["Özellikle şunlar işlenir:"],
        list: [
          "Ana veriler (ad, e-posta, üye no, telefon/adres)",
          "Kullanım ve içerik verileri (giriş, kayıt, duyuru)",
          "Ödeme/bağış verileri (tutar, durum)",
          "İlgili kişiler: üyeler, veli/öğrenci, bağışçılar, yöneticiler",
        ],
      },
      {
        heading: "3. Talimata bağlılık",
        paragraphs: [
          "Veri İşleyen, kişisel verileri yalnızca Veri Sorumlusu'nun belgelenmiş talimatı doğrultusunda işler. Bir talimatın GDPR'a aykırı olduğu kanaatine varırsa Veri Sorumlusu'nu derhal bilgilendirir (Madde 28(3) c. 2).",
        ],
      },
      {
        heading: "4. Gizlilik",
        paragraphs: [
          "Veri İşleyen, yetkili kişilerin gizlilik yükümlülüğü altında olmasını sağlar.",
        ],
      },
      {
        heading: "5. Teknik ve idari tedbirler (TOM)",
        paragraphs: [
          "Veri İşleyen, Madde 32 uyarınca gerekli teknik ve idari tedbirleri (TOM) alır: TLS şifreleme, erişim kontrolü, hash'lenmiş IP saklama, rate-limiting, rotasyonlu yedekleme ve kiracı ayrımı (mosque_id). Detaylar TOM ekinde açıklanır.",
        ],
      },
      {
        heading: "6. Alt veri işleyenler",
        paragraphs: [
          "Veri Sorumlusu, aşağıdaki alt işleyenlerin kullanımına onay verir; değişikliklerde itiraz hakkı saklıdır:",
        ],
        list: [
          "Hetzner Online GmbH (barındırma, Almanya)",
          "Stripe Payments Europe Ltd. (ödeme)",
          "Resend (e-posta gönderimi)",
          "Anthropic (YZ işlevleri, AB standart sözleşme maddeleriyle)",
        ],
      },
      {
        heading: "7. Veri Sorumlusu'na destek",
        paragraphs: [
          "Veri İşleyen; ilgili kişi haklarının (Madde 12-22), veri ihlali bildirimlerinin (Madde 33/34) ve veri koruma etki değerlendirmelerinin (Madde 35/36) yerine getirilmesinde makul ölçüde destek olur ve ihlalleri derhal bildirir.",
        ],
      },
      {
        heading: "8. Silme ve iade",
        paragraphs: [
          "İşleme sonunda Veri İşleyen, yasal saklama yükümlülüğü yoksa verileri Veri Sorumlusu'nun seçimine göre siler veya iade eder. Sözleşme onayı kanıtları ispat için ayrıca saklanabilir.",
        ],
      },
      {
        heading: "9. Kanıt ve denetim",
        paragraphs: [
          "Veri İşleyen, Madde 28 yükümlülüklerine uyumun kanıtı için gerekli bilgileri sağlar ve makul ölçüde denetimlere imkân verir.",
        ],
      },
      {
        heading: "10. Sorumluluk",
        paragraphs: [
          "Taraflar arasındaki sorumluluk Madde 82 ve Kullanım Sözleşmesi'ne tabidir.",
        ],
      },
      {
        heading: "11. Son hükümler",
        paragraphs: [
          "Alman hukuku geçerlidir. Almanca metin bağlayıcıdır. Veri koruma konularında çelişkide bu AVV önceliklidir.",
        ],
      },
    ],
  },
};

export default AVV_V1;
