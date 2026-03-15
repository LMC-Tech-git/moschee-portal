import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AuthProvider } from "@/lib/auth-context";
import { MosqueProvider } from "@/lib/mosque-context";
import { ServiceWorkerRegistration } from "@/components/shared/ServiceWorkerRegistration";
import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer";
import { DemoBanner } from "@/components/shared/DemoBanner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#059669",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://moschee.app"),
  title: {
    default: "moschee.app — Die digitale Plattform für Moscheegemeinden",
    template: "%s | moschee.app",
  },
  description:
    "Die digitale Plattform für muslimische Gemeinden in Deutschland. Gebetszeiten, Mitglieder, Spenden, Veranstaltungen und Madrasa – alles in einem Portal.",
  keywords: [
    "Moschee",
    "Gemeinde",
    "Spenden",
    "Gebetszeiten",
    "Islam",
    "Deutschland",
    "Madrasa",
  ],
  alternates: {
    canonical: "https://moschee.app",
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: "https://moschee.app",
    siteName: "moschee.app",
    title: "moschee.app — Die digitale Plattform für Moscheegemeinden",
    description:
      "Die digitale Plattform für muslimische Gemeinden in Deutschland. Gebetszeiten, Veranstaltungen, Spenden und mehr.",
  },
  twitter: {
    card: "summary_large_image",
    title: "moschee.app — Die digitale Plattform für Moscheegemeinden",
    description:
      "Die digitale Plattform für muslimische Gemeinden in Deutschland.",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "moschee.app",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-emerald-700 focus:shadow-lg focus:ring-2 focus:ring-emerald-500"
        >
          Zum Inhalt springen
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider>
            <MosqueProvider>
              <div className="flex min-h-screen flex-col">
                <Header />
                <DemoBanner />
                <main id="main-content" className="flex-1">{children}</main>
                <Footer />
              </div>
              <Toaster position="top-right" richColors />
            </MosqueProvider>
          </AuthProvider>
        </NextIntlClientProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
