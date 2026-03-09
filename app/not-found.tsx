import Link from "next/link";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h1 className="mb-2 text-6xl font-extrabold text-primary-500">404</h1>
      <h2 className="mb-2 text-2xl font-bold text-gray-900">
        Seite nicht gefunden
      </h2>
      <p className="mb-8 text-center text-gray-600">
        Die angeforderte Seite existiert nicht oder wurde verschoben.
      </p>
      <Button asChild>
        <Link href="/" className="inline-flex items-center gap-2">
          <Home className="h-4 w-4" />
          Zur Startseite
        </Link>
      </Button>
    </div>
  );
}
