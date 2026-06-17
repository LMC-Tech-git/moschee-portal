import type { FrozenDocByLocale } from "./types";

// Nutzungsvereinbarung v1 - no curly-quote chars in strings (SWC parser bug)
const NUTZUNGSVEREINBARUNG_V1: FrozenDocByLocale = {
  de: {
    title: "Nutzungsvereinbarung (SaaS)",
    notice:
      "ENTWURF - Diese Fassung ist vor dem Produktiveinsatz anwaltlich zu prüfen. Sie wird wirksam mit der digitalen Bestätigung durch eine vertretungsberechtigte Person der Gemeinde.",
    effective: "2026-01-01",
    sections: [
      {
        heading: "1. Vertragsparteien",
        paragraphs: [
          "Diese Vereinbarung wird geschlossen zwischen LMC Tech als Betreiber des Moschee-Portals (nachfolgend: Betreiber) und der registrierten Gemeinde, vertreten durch die bei der Annahme benannte vertretungsberechtigte Person (nachfolgend: Gemeinde).",
        ],
      },
      {
        heading: "2. Vertragsgegenstand / Leistungen",
        paragraphs: [
          "Der Betreiber stellt der Gemeinde das Moschee-Portal als Software-as-a-Service über das Internet zur Verfügung. Der Leistungsumfang umfasst die jeweils freigeschalteten Module (z. B. Gebetszeiten, Veranstaltungen, Beiträge, Mitglieder- und Spendenverwaltung, Madrasa). Der Betreiber kann Funktionen weiterentwickeln, solange der vereinbarte Kernnutzen erhalten bleibt.",
        ],
      },
      {
        heading: "3. Vergütung",
        paragraphs: [
          "Die Nutzung erfolgt zu den im Bestell- bzw. Preismodell vereinbarten Konditionen. Soweit kein gesondertes Entgelt vereinbart ist, gilt die jeweils angebotene Variante (z. B. Basis-/Förderpaket). Zahlungsdienstleister-Gebühren für Spenden/Zahlungen trägt die Gemeinde gemäß den Bedingungen des Dienstleisters.",
        ],
      },
      {
        heading: "4. Laufzeit und Kündigung",
        paragraphs: [
          "Die Vereinbarung läuft auf unbestimmte Zeit. Sie kann von beiden Parteien mit einer Frist von 30 Tagen zum Monatsende in Textform gekündigt werden. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Nach Vertragsende werden die Daten gemäß AVV gelöscht oder zurückgegeben.",
        ],
      },
      {
        heading: "5. Pflichten der Gemeinde",
        paragraphs: [
          "Die Gemeinde benennt verantwortliche Administratoren, hält Zugangsdaten geheim und nutzt das Portal nur im Rahmen der geltenden Gesetze. Sie ist für die Rechtmäßigkeit der von ihr eingestellten Inhalte und der Verarbeitung ihrer Mitgliederdaten verantwortlich (siehe AVV).",
        ],
      },
      {
        heading: "6. Verfügbarkeit (SLA)",
        paragraphs: [
          "Der Betreiber strebt eine Verfügbarkeit von 99 % im Jahresmittel an, gemessen außerhalb angekündigter Wartungsfenster. Wartung, Störungen und höhere Gewalt können zu vorübergehenden Einschränkungen führen. Ein darüber hinausgehender Verfügbarkeitsanspruch besteht nicht.",
        ],
      },
      {
        heading: "7. Daten- und Nutzungsrechte",
        paragraphs: [
          "Die von der Gemeinde eingestellten Inhalte und Mitgliederdaten bleiben ihr Eigentum bzw. ihre Verantwortung. Der Betreiber erhält nur die zur Leistungserbringung erforderlichen Rechte. Rechte an der Software selbst verbleiben beim Betreiber.",
        ],
      },
      {
        heading: "8. Haftungsbegrenzung",
        paragraphs: [
          "Der Betreiber haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper und Gesundheit. Bei einfacher Fahrlässigkeit haftet er nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) und der Höhe nach begrenzt auf den vertragstypisch vorhersehbaren Schaden. Eine Haftung für Datenverlust ist auf den Aufwand begrenzt, der bei ordnungsgemäßer Datensicherung zur Wiederherstellung erforderlich gewesen wäre.",
        ],
      },
      {
        heading: "9. Datenschutz / Auftragsverarbeitung",
        paragraphs: [
          "Soweit der Betreiber personenbezogene Daten im Auftrag der Gemeinde verarbeitet, gilt ergänzend der Auftragsverarbeitungsvertrag (AVV), den die Gemeinde mit dieser Vereinbarung ebenfalls abschließt.",
        ],
      },
      {
        heading: "10. Schlussbestimmungen",
        paragraphs: [
          "Es gilt deutsches Recht. Gerichtsstand ist, soweit gesetzlich zulässig, der Sitz des Betreibers. Sollten einzelne Bestimmungen unwirksam sein, bleibt die Vereinbarung im Übrigen wirksam. Maßgeblich ist die deutsche Fassung; Übersetzungen sind unverbindlich.",
        ],
      },
    ],
  },
  tr: {
    title: "Kullanım Sözleşmesi (SaaS)",
    notice:
      "TASLAK - Bu metin yürürlüğe girmeden önce hukuken incelenmelidir. Almanca metin bağlayıcıdır; bu Türkçe çeviri yalnızca kolaylık amaçlıdır.",
    effective: "2026-01-01",
    sections: [
      {
        heading: "1. Taraflar",
        paragraphs: [
          "Bu sözleşme, Cami Portalı işletmecisi LMC Tech (İşletmeci) ile kayıtlı cemaat (onay sırasında belirtilen temsile yetkili kişi tarafından temsil edilen, Cemaat) arasında akdedilir.",
        ],
      },
      {
        heading: "2. Konu / Hizmetler",
        paragraphs: [
          "İşletmeci, Cami Portalı'nı internet üzerinden hizmet olarak yazılım (SaaS) biçiminde sunar. Kapsam, etkinleştirilen modülleri içerir ve geliştirilebilir.",
        ],
      },
      {
        heading: "3. Ücret",
        paragraphs: [
          "Kullanım, kararlaştırılan fiyat modeline göredir. Ayrı bir ücret yoksa sunulan varyant geçerlidir. Bağış/ödeme sağlayıcı ücretlerini Cemaat üstlenir.",
        ],
      },
      {
        heading: "4. Süre ve fesih",
        paragraphs: [
          "Sözleşme belirsiz sürelidir ve her iki tarafça ay sonuna 30 gün kala yazılı olarak feshedilebilir. Haklı sebeple olağanüstü fesih saklıdır. Sona ermeden sonra veriler AVV'ye göre silinir veya iade edilir.",
        ],
      },
      {
        heading: "5. Cemaatin yükümlülükleri",
        paragraphs: [
          "Cemaat sorumlu yöneticileri belirler, giriş bilgilerini gizli tutar ve portalı yalnızca yürürlükteki yasalar çerçevesinde kullanır. İçeriklerin ve üye verilerinin hukuka uygunluğundan sorumludur (bkz. AVV).",
        ],
      },
      {
        heading: "6. Erişilebilirlik (SLA)",
        paragraphs: [
          "İşletmeci, duyurulan bakım pencereleri dışında yıllık ortalama %99 erişilebilirlik hedefler. Bakım, arıza ve mücbir sebep geçici kısıtlamalara yol açabilir.",
        ],
      },
      {
        heading: "7. Veri ve kullanım hakları",
        paragraphs: [
          "Cemaatin içerikleri ve üye verileri kendi sorumluluğunda kalır. İşletmeci yalnızca hizmet için gerekli hakları alır; yazılım hakları İşletmeci'de kalır.",
        ],
      },
      {
        heading: "8. Sorumluluğun sınırlandırılması",
        paragraphs: [
          "İşletmeci kasıt/ağır ihmal ve can-sağlık ihlallerinde sınırsız; hafif ihmalde yalnızca esaslı yükümlülük ihlallerinde ve öngörülebilir zararla sınırlı sorumludur. Veri kaybı sorumluluğu, usulüne uygun yedeklemeyle kurtarma maliyetiyle sınırlıdır.",
        ],
      },
      {
        heading: "9. Veri koruması / veri işleme",
        paragraphs: [
          "İşletmeci, Cemaat adına kişisel veri işlediği ölçüde, bu sözleşmeyle birlikte akdedilen Veri İşleme Sözleşmesi (AVV) tamamlayıcı olarak geçerlidir.",
        ],
      },
      {
        heading: "10. Son hükümler",
        paragraphs: [
          "Alman hukuku geçerlidir. Yetkili mahkeme, yasal olarak mümkün olduğu ölçüde İşletmeci'nin merkezidir. Hükümlerden biri geçersiz olsa da sözleşme geri kalanı geçerli kalır. Almanca metin bağlayıcıdır.",
        ],
      },
    ],
  },
};

export default NUTZUNGSVEREINBARUNG_V1;
