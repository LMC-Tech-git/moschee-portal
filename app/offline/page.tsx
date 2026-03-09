import { WifiOff, RefreshCw } from "lucide-react";

export const metadata = {
  title: "Offline - Moschee-Portal",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
        <WifiOff className="h-10 w-10 text-gray-400" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">
        Keine Verbindung
      </h1>
      <p className="mb-6 max-w-md text-gray-500">
        Sie sind aktuell offline. Bitte prüfen Sie Ihre Internetverbindung und
        versuchen Sie es erneut.
      </p>
      <a
        href="/"
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
      >
        <RefreshCw className="h-4 w-4" />
        Erneut versuchen
      </a>
    </div>
  );
}
