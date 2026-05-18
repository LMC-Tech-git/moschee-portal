"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Mail, CheckCircle, Download, Eye } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useMosque } from "@/lib/mosque-context";
import {
  getDonationReceiptData,
  sendDonationReceiptByEmail,
  type DonationReceiptData,
} from "@/lib/actions/members";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function SpendenbescheinigungPage() {
  const { user } = useAuth();
  const { mosqueId } = useMosque();
  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  const [data, setData] = useState<DonationReceiptData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedYear, setSelectedYear] = useState(year);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    if (!user || !mosqueId) return;

    async function load() {
      setIsLoading(true);
      setError("");
      setEmailSent(false);
      const result = await getDonationReceiptData(
        user!.id,
        mosqueId,
        selectedYear
      );
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || "Daten konnten nicht geladen werden");
      }
      setIsLoading(false);
    }

    load();
  }, [user, mosqueId, selectedYear]);

  const hasDonations = !!data && data.donations.length > 0;

  async function handleSendEmail() {
    if (!user || !mosqueId) return;
    setIsSendingEmail(true);
    setEmailError("");
    setEmailSent(false);
    const result = await sendDonationReceiptByEmail(
      user.id,
      mosqueId,
      selectedYear
    );
    if (result.success) {
      setEmailSent(true);
    } else {
      setEmailError(result.error || "E-Mail konnte nicht gesendet werden");
    }
    setIsSendingEmail(false);
  }

  function pdfUrl(disposition: "inline" | "attachment") {
    return `/api/receipts?scope=member&year=${selectedYear}&disposition=${disposition}`;
  }

  function handleView() {
    // Inline öffnen → Browser-PDF-Viewer (auch zum Drucken nutzbar).
    window.open(pdfUrl("inline"), "_blank", "noopener,noreferrer");
  }

  async function handleDownloadPdf() {
    setPdfError("");
    setIsDownloadingPdf(true);
    try {
      const res = await fetch(pdfUrl("attachment"));
      if (!res.ok) {
        setPdfError(
          res.status === 404
            ? "Keine Spenden für dieses Jahr vorhanden"
            : "PDF konnte nicht erstellt werden"
        );
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] || `spendenbescheinigung-${selectedYear}.pdf`;
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(u);
    } catch {
      setPdfError("PDF konnte nicht erstellt werden");
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  if (!user) return null;

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

  function formatEuro(cents: number): string {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-3">
          <Link
            href="/member/profile"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Zurück zum Profil"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            Spendenbescheinigung
          </h1>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="ml-auto rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-gray-500">
          Ihre BMF-konforme Zuwendungsbestätigung als PDF — ansehen, drucken,
          herunterladen oder per E-Mail zusenden.
        </p>
      </div>

      {(emailError || pdfError) && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {emailError || pdfError}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : !hasDonations ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16">
          <FileText
            className="mb-3 h-12 w-12 text-gray-300"
            aria-hidden="true"
          />
          <p className="mb-1 text-sm font-medium text-gray-600">
            Keine Spenden im Jahr {selectedYear}
          </p>
          <p className="text-xs text-gray-400">
            Es wurden keine bezahlten Spenden in diesem Jahr gefunden.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Zusammenfassung */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">{data!.mosque.name}</p>
            <p className="mt-3 text-sm text-gray-500">
              Bescheinigung für {data!.donor.full_name} · Jahr {selectedYear}
            </p>
            <div className="mt-4 flex items-baseline justify-between border-t border-gray-100 pt-4">
              <span className="text-sm text-gray-600">
                {data!.donations.length} bezahlte Spende
                {data!.donations.length === 1 ? "" : "n"}
              </span>
              <span className="text-2xl font-bold text-emerald-700">
                {formatEuro(data!.totalCents)}
              </span>
            </div>
          </div>

          {/* Aktionen */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleView}
              variant="outline"
              className="flex-1"
            >
              <Eye className="mr-2 h-4 w-4" />
              Ansehen / Drucken
            </Button>
            <Button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              variant="outline"
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              {isDownloadingPdf ? "Erstelle..." : "Als PDF herunterladen"}
            </Button>
            {emailSent ? (
              <span className="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-emerald-600">
                <CheckCircle className="h-4 w-4" />
                E-Mail gesendet
              </span>
            ) : (
              <Button
                onClick={handleSendEmail}
                disabled={isSendingEmail}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <Mail className="mr-2 h-4 w-4" />
                {isSendingEmail ? "Sende..." : "Per E-Mail"}
              </Button>
            )}
          </div>

          <p className="text-xs text-gray-400">
            Das PDF enthält alle steuerlich erforderlichen Pflichtangaben
            (§ 10b EStG). Bei Beträgen bis 300 € genügt der Kontoauszug
            zusammen mit dieser Bestätigung (§ 50 Abs. 4 EStDV).
          </p>
        </div>
      )}
    </div>
  );
}
