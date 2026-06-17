"use client";

import { useEffect, useState } from "react";
import { Copy, Check, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { buildGirocodeString, normalizeIban } from "@/lib/epc-qr";
import { formatCurrencyCents } from "@/lib/utils";

interface BankTransferCardProps {
  iban: string;
  bic: string;
  holder: string;
  remittance: string;
  /** Wenn gesetzt (>0), wird der Betrag in den QR kodiert (dynamisch). */
  amountCents?: number;
}

function CopyRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const t = useTranslations("donationForm");
  const [copied, setCopied] = useState(false);
  const canCopy =
    typeof navigator !== "undefined" && !!navigator.clipboard;

  async function handleCopy() {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no-op */
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`truncate text-sm text-gray-900 ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
      {canCopy && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={t("transferCopy")}
          className="flex shrink-0 items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              {t("transferCopied")}
            </>
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

export function BankTransferCard({
  iban,
  bic,
  holder,
  remittance,
  amountCents,
}: BankTransferCardProps) {
  const t = useTranslations("donationForm");
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
    const epcString = buildGirocodeString({
      name: holder,
      iban,
      bic,
      amountCents,
      remittance,
    });
    if (!epcString) {
      setSvg("");
      return;
    }
    // Debounce: Betragsfeld feuert pro Tastendruck — nicht jedes Mal neu rendern.
    const timer = setTimeout(async () => {
      try {
        const mod = await import("qrcode");
        const generated = await mod.toString(epcString, {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: 1,
          width: 280,
        });
        if (!cancelled) setSvg(generated);
      } catch {
        if (!cancelled) setSvg("");
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [iban, bic, holder, remittance, amountCents]);

  const displayIban = normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-700">
        <QrCode className="h-4 w-4 text-emerald-600" />
        {t("transferTitle")}
      </div>

      <div className="flex justify-center">
        {svg ? (
          <div
            className="w-full max-w-[280px] [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="flex h-[280px] w-full max-w-[280px] items-center justify-center rounded-lg bg-gray-50 text-center text-sm text-gray-400">
            {t("transferUnavailable")}
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-gray-500">{t("transferScanHint")}</p>

      <div className="mt-4 divide-y divide-gray-100 border-t border-gray-100 pt-2">
        <CopyRow label={t("transferHolder")} value={holder} />
        <CopyRow label={t("transferIban")} value={displayIban} mono />
        {bic && <CopyRow label={t("transferBic")} value={bic} mono />}
        {typeof amountCents === "number" && amountCents > 0 && (
          <CopyRow label={t("transferAmount")} value={formatCurrencyCents(amountCents)} />
        )}
        {remittance && <CopyRow label={t("transferPurpose")} value={remittance} />}
      </div>
    </div>
  );
}
