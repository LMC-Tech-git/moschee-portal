"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PWAInstallPrompt } from "@/components/shared/PWAInstallPrompt";
import { IOSInstallHint } from "@/components/shared/IOSInstallHint";
import { MosqueLegalGate } from "@/components/legal/MosqueLegalGate";
import { UserLegalGate } from "@/components/legal/UserLegalGate";
import type { LegalDocType, LegalLocale } from "@/lib/legal";

/**
 * Client-Hülle des Auth-Layouts. Hält die Auth-Weiterleitung + Spinner und
 * rendert die Rechts-Gates. Der Gate-Status wird server-seitig (Layout)
 * aufgelöst und als Prop übergeben → kein Flash, kein Client-Roundtrip.
 */
export default function AuthShell({
  children,
  mosqueOutstanding,
  userOutstanding,
  locale,
}: {
  children: React.ReactNode;
  mosqueOutstanding: LegalDocType[];
  userOutstanding: LegalDocType[];
  locale: LegalLocale;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-500" />
          <p className="text-sm text-gray-500">Authentifizierung wird geprüft...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {children}
      <PWAInstallPrompt />
      <IOSInstallHint />
      <MosqueLegalGate outstanding={mosqueOutstanding} locale={locale} />
      <UserLegalGate outstanding={userOutstanding} locale={locale} />
    </>
  );
}
