import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk, Noto_Naskh_Arabic, Fraunces } from "next/font/google";
import "./tv.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  other: { "cache-control": "no-store, no-cache, must-revalidate" },
};

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const fontDisplay = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

const fontArabic = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  variable: "--font-naskh",
  display: "swap",
  weight: ["400", "500", "700"],
});

const fontSerif = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

/**
 * Minimal-Layout für die öffentliche TV-Anzeige.
 * Lädt Fonts als CSS-Variablen — TVClient + Slides nutzen sie via tv.css Token.
 */
export default function TVLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fontMono.variable} ${fontDisplay.variable} ${fontArabic.variable} ${fontSerif.variable}`}>
      {children}
    </div>
  );
}
