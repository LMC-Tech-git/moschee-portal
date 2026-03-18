"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, FileText, Mail, CheckCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useMosque } from "@/lib/mosque-context";
import { getDonationReceiptData, sendDonationReceiptByEmail, type DonationReceiptData } from "@/lib/actions/members";
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

  useEffect(() => {
    if (!user || !mosqueId) return;

    async function load() {
      setIsLoading(true);
      setError("");
      const result = await getDonationReceiptData(user!.id, mosqueId, selectedYear);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || "Daten konnten nicht geladen werden");
      }
      setIsLoading(false);
    }

    load();
  }, [user, mosqueId, selectedYear]);

  async function handleSendEmail() {
    if (!user || !mosqueId) return;
    setIsSendingEmail(true);
    setEmailError("");
    setEmailSent(false);
    const result = await sendDonationReceiptByEmail(user.id, mosqueId, selectedYear);
    if (result.success) {
      setEmailSent(true);
    } else {
      setEmailError(result.error || "E-Mail konnte nicht gesendet werden");
    }
    setIsSendingEmail(false);
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

  function formatDateDE(dateStr: string): string {
    if (!dateStr) return "—";
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(dateStr));
  }

  return (
    <div className="mx-auto max-w-3xl py-8">
      {/* Toolbar — wird beim Drucken ausgeblendet */}
      <div className="mb-6 print:hidden">
        <div className="flex items-center gap-3 mb-3">
          <Link
            href="/member/profile"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Zurück zum Profil"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
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
        <div className="flex gap-2">
          {emailSent ? (
            <span className="flex items-center gap-2 text-sm font-medium text-emerald-600 px-3 py-2">
              <CheckCircle className="h-4 w-4" />
              E-Mail gesendet
            </span>
          ) : (
            <Button
              onClick={handleSendEmail}
              disabled={!data || data.donations.length === 0 || isSendingEmail}
              variant="outline"
              className="flex-1 sm:flex-none"
            >
              <Mail className="mr-2 h-4 w-4" />
              {isSendingEmail ? "Sende..." : "Per E-Mail"}
            </Button>
          )}
          <Button
            onClick={() => window.print()}
            disabled={!data || data.donations.length === 0}
            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700"
          >
            <Printer className="mr-2 h-4 w-4" />
            Drucken / PDF
          </Button>
        </div>
      </div>

      {emailError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 print:hidden">
          {emailError}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : !data || data.donations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16">
          <FileText className="mb-3 h-12 w-12 text-gray-300" aria-hidden="true" />
          <p className="mb-1 text-sm font-medium text-gray-600">
            Keine Spenden im Jahr {selectedYear}
          </p>
          <p className="text-xs text-gray-400">
            Es wurden keine bezahlten Spenden in diesem Jahr gefunden.
          </p>
        </div>
      ) : (
        /* Druckbarer Bereich */
        <div className="rounded-xl border border-gray-200 bg-white p-8 print:border-0 print:p-0 print:shadow-none">
          {/* Briefkopf */}
          <div className="mb-8 border-b-2 border-emerald-600 pb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {data.mosque.name}
            </h2>
            <p className="text-sm text-gray-600">
              {data.mosque.address}
              {data.mosque.city && `, ${data.mosque.city}`}
            </p>
          </div>

          {/* Titel */}
          <div className="mb-8 text-center">
            <h3 className="text-2xl font-bold text-gray-900">
              Spendenbescheinigung
            </h3>
            <p className="mt-1 text-lg text-gray-600">
              für das Jahr {data.year}
            </p>
          </div>

          {/* Spender-Info */}
          <div className="mb-8 rounded-lg bg-gray-50 p-4 print:bg-transparent print:border print:border-gray-300">
            <p className="text-sm text-gray-500">Spender/in:</p>
            <p className="text-lg font-semibold text-gray-900">
              {data.donor.full_name}
            </p>
            {data.donor.membership_number && data.donor.membership_number !== "-" && (
              <p className="text-sm text-gray-600">
                Mitgliedsnr.: {data.donor.membership_number}
              </p>
            )}
          </div>

          {/* Spenden-Tabelle */}
          <table className="mb-8 w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="pb-2 pr-4">Nr.</th>
                <th className="pb-2 pr-4">Datum</th>
                <th className="pb-2 pr-4">Zahlungsart</th>
                <th className="pb-2 text-right">Betrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.donations.map((d, i) => (
                <tr key={d.id}>
                  <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
                  <td className="py-2 pr-4">{formatDateDE(d.paid_at)}</td>
                  <td className="py-2 pr-4 capitalize text-gray-600">
                    {d.provider === "stripe"
                      ? "Kreditkarte/SEPA"
                      : d.provider === "paypal_link"
                      ? "PayPal"
                      : d.provider === "manual"
                      ? "Barzahlung"
                      : d.provider}
                  </td>
                  <td className="py-2 text-right font-medium">
                    {formatEuro(d.amount_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-900">
                <td colSpan={3} className="py-3 text-right font-bold text-gray-900">
                  Gesamtsumme {data.year}:
                </td>
                <td className="py-3 text-right text-lg font-bold text-emerald-700">
                  {formatEuro(data.totalCents)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Hinweis */}
          <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 print:bg-transparent print:border-gray-300 print:text-gray-600">
            <p className="font-semibold">Hinweis:</p>
            <p className="mt-1">
              Diese Übersicht dient als Bestätigung Ihrer Spenden an {data.mosque.name}.
              Bitte bewahren Sie diese Bescheinigung für Ihre Unterlagen auf.
              Bei Beträgen bis 300,00 EUR genügt als Nachweis der Kontoauszug
              zusammen mit dieser Bestätigung (§ 50 Abs. 4 EStDV).
            </p>
          </div>

          {/* Unterschrift */}
          <div className="mt-12 flex justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Ausgestellt am: {formatDateDE(new Date().toISOString())}
              </p>
            </div>
            <div className="text-center">
              <div className="mb-2 h-px w-48 border-b border-gray-400" />
              <p className="text-xs text-gray-500">
                {data.mosque.name}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
