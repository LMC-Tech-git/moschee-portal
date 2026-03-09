"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error.digest);
  }, [error]);

  return (
    <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <AlertTriangle className="mb-4 h-12 w-12 text-secondary-500" aria-hidden="true" />
      <h2 className="mb-2 text-2xl font-bold text-gray-900">
        Etwas ist schiefgelaufen
      </h2>
      <p className="mb-6 text-center text-gray-600">
        Es ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es
        erneut.
      </p>
      <Button onClick={reset}>
        Erneut versuchen
      </Button>
    </div>
  );
}
