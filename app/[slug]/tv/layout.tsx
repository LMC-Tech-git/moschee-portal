import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  other: { "cache-control": "no-store, no-cache, must-revalidate" },
};

/**
 * Minimal-Layout für die öffentliche TV-Anzeige.
 * Wrappt nur — globales Layout (HTML/Body) kommt aus app/layout.tsx,
 * Slug-Layout-Bypass passiert in app/[slug]/layout.tsx via x-tv-route Header.
 */
export default function TVLayout({ children }: { children: React.ReactNode }) {
  return <div className="tv-root">{children}</div>;
}
