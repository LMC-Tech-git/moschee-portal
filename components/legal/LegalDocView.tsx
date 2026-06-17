import { Fragment } from "react";
import type { FrozenDoc, LegalSection } from "@/lib/legal-texts";

/**
 * Rendert einen eingefrorenen Rechtstext (FrozenDoc). Rein präsentationell —
 * nutzbar als Server Component (Seiten) und innerhalb der Gate-Modals (Client).
 * Anzeige == Beweis: derselbe Text, dessen Hash gespeichert wird.
 */

function Paragraph({ text, link }: { text: string; link?: LegalSection["link"] }) {
  if (link && text.includes("{link}")) {
    const [before, after] = text.split("{link}");
    return (
      <p className="mt-2">
        {before}
        <a
          href={link.href}
          target={link.href.startsWith("http") ? "_blank" : undefined}
          rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="text-primary-600 underline hover:text-primary-700"
        >
          {link.label}
        </a>
        {after}
      </p>
    );
  }
  return <p className="mt-2">{text.replace("{link}", link?.label ?? "")}</p>;
}

export function LegalDocView({ doc }: { doc: FrozenDoc }) {
  return (
    <div className="text-gray-600">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">{doc.title}</h1>
      <p className="mb-6 text-sm text-gray-400">Fassung gültig ab {doc.effective}</p>

      {doc.notice && (
        <div
          role="note"
          className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800"
        >
          {doc.notice}
        </div>
      )}

      <div className="space-y-8">
        {doc.sections.map((section, i) => (
          <div key={i}>
            {section.heading && (
              <h2 className="text-xl font-bold text-gray-900">{section.heading}</h2>
            )}
            {(section.paragraphs || []).map((p, j) => (
              <Fragment key={j}>
                <Paragraph text={p} link={section.link} />
              </Fragment>
            ))}
            {section.list && section.list.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-6">
                {section.list.map((li, k) => (
                  <li key={k}>{li}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
