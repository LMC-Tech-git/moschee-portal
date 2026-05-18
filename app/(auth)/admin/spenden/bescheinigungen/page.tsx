"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  FileText,
  Download,
  Eye,
  Users,
  AlertTriangle,
} from "lucide-react";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import {
  getReceiptYearDonors,
  type ReceiptDonorRow,
} from "@/lib/actions/receipts";
import { formatCurrencyCents } from "@/lib/utils";

export default function BescheinigungenPage() {
  const t = useTranslations("receipts");
  const { user } = useAuth();
  const { mosqueId } = useMosque();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [rows, setRows] = useState<ReceiptDonorRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const load = useCallback(async () => {
    if (!mosqueId) return;
    setIsLoading(true);
    setError("");
    const res = await getReceiptYearDonors(mosqueId, year);
    setIsLoading(false);
    if (res.success && res.data) {
      setRows(res.data);
    } else {
      setError(res.error || t("loadError"));
    }
  }, [mosqueId, year, t]);

  useEffect(() => {
    load();
  }, [load]);

  function buildUrl(
    mode: "einzel-spender" | "sammel-alle",
    disposition: "inline" | "attachment",
    donorUserId?: string
  ) {
    const p = new URLSearchParams({
      scope: "admin",
      year: String(year),
      mode,
      disposition,
    });
    if (donorUserId) p.set("donorUserId", donorUserId);
    return `/api/receipts?${p.toString()}`;
  }

  function preview(donorUserId: string) {
    window.open(
      buildUrl("einzel-spender", "inline", donorUserId),
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function download(url: string, fallbackName: string) {
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch(url);
      if (!res.ok) {
        setError(
          res.status === 404 ? t("emptyYear", { year }) : t("genError")
        );
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const name = m?.[1] || fallbackName;
      const gen = res.headers.get("X-Receipt-Generated-Count");
      const skip = res.headers.get("X-Receipt-Skipped-Count");
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = name;
      a.click();
      URL.revokeObjectURL(u);
      if (gen) {
        setNotice(
          t("genResult", {
            generated: gen,
            skipped: skip || "0",
          })
        );
      }
    } catch {
      setError(t("genError"));
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  const missingAddressNames = (rows || [])
    .filter((r) => r.addressMissing)
    .map((r) => r.name);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/spenden"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("backToDonations")}
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              download(
                buildUrl("sammel-alle", "attachment"),
                `spendenbescheinigungen-${year}.pdf`
              )
            }
            disabled={busy || !rows || rows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            {t("bulkAll")}
          </button>
        </div>
      </div>

      {missingAddressNames.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            {t("missingAddressWarn", { count: missingAddressNames.length })}{" "}
            {missingAddressNames.join(", ")}
          </span>
        </div>
      )}

      {notice && (
        <p className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          </div>
        ) : !rows || rows.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-gray-200" />
            <p className="font-medium text-gray-500">
              {t("emptyYear", { year })}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 divide-y divide-gray-100">
            {rows.map((row) => (
              <div
                key={row.userId}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900">{row.name}</p>
                    {row.addressMissing && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        <AlertTriangle className="h-3 w-3" />
                        {t("addressMissing")}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-gray-500">{row.email}</p>
                </div>
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrencyCents(row.totalCents)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t("donationCount", { count: row.count })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => preview(row.userId)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {t("preview")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        download(
                          buildUrl(
                            "einzel-spender",
                            "attachment",
                            row.userId
                          ),
                          `spendenbescheinigung-${year}.pdf`
                        )
                      }
                      disabled={busy || row.addressMissing}
                      title={
                        row.addressMissing ? t("addressMissingHint") : undefined
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t("pdf")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
