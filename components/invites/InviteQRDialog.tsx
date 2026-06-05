"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Printer, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Fertige Pfad-URL, die der QR-Code enthalten soll */
  url: string;
  mosqueName: string;
  mosqueLogoUrl: string | null;
  /** Invite-Bezeichnung (Gruppenname) */
  label: string;
  /** Bereits übersetztes Rollen-Label */
  roleLabel: string;
}

function slugifyForFile(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "invite"
  );
}

export function InviteQRDialog({
  open,
  onClose,
  url,
  mosqueName,
  mosqueLogoUrl,
  label,
  roleLabel,
}: Props) {
  const t = useTranslations("invites");

  const [png, setPng] = useState<string | null>(null);
  const [logoOk, setLogoOk] = useState(true);

  useEffect(() => {
    if (!open) {
      setPng(null);
      return;
    }
    setLogoOk(true);
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("qrcode");
        const dataUrl = await mod.toDataURL(url, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 1024,
        });
        if (!cancelled) setPng(dataUrl);
      } catch {
        if (!cancelled) {
          setPng(null);
          toast.error(t("qr.toastFailed"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, url, t]);

  function handlePrint() {
    document.body.classList.add("printing-invite-qr");
    const cleanup = () => {
      document.body.classList.remove("printing-invite-qr");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  const fileName = `qr-${slugifyForFile(label || mosqueName)}.png`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-emerald-600" />
            {t("qr.title", { label })}
          </DialogTitle>
          <DialogDescription>{t("qr.intro")}</DialogDescription>
        </DialogHeader>

        {/* Bildschirm-Vorschau */}
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-center rounded-lg border bg-white p-4">
            {png ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={png}
                alt={t("qr.imgAlt")}
                className="h-56 w-56 max-w-full"
              />
            ) : (
              <div className="flex h-56 w-56 items-center justify-center text-sm text-gray-400">
                {t("qr.generating")}
              </div>
            )}
          </div>
          <p className="break-all text-center font-mono text-xs text-gray-500">
            {url}
          </p>
        </div>

        <DialogFooter className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button
            asChild
            variant="outline"
            disabled={!png}
            className="w-full sm:w-auto"
          >
            <a
              href={png ?? undefined}
              download={fileName}
              aria-disabled={!png}
              onClick={(e) => {
                if (!png) e.preventDefault();
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              {t("qr.download")}
            </a>
          </Button>
          <Button
            onClick={handlePrint}
            disabled={!png}
            className="w-full sm:w-auto"
          >
            <Printer className="mr-2 h-4 w-4" />
            {t("qr.print")}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            {t("qr.close")}
          </Button>
        </DialogFooter>

        {/* Druck-Sheet (A4) — nur beim Drucken sichtbar */}
        <div className="invite-print-sheet hidden print:block">
          <div className="mx-auto flex max-w-[640px] flex-col items-center text-center">
            {mosqueLogoUrl && logoOk && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mosqueLogoUrl}
                alt={mosqueName}
                className="mb-4 max-h-24 w-auto object-contain"
                onError={() => setLogoOk(false)}
              />
            )}
            <p className="text-lg font-semibold text-gray-700">{mosqueName}</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              {t("qr.printHeading")}
            </h1>
            {label && (
              <p className="mt-1 text-base text-gray-600">
                {label} · {roleLabel}
              </p>
            )}

            {png && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={png}
                alt={t("qr.imgAlt")}
                className="my-8 h-72 w-72"
              />
            )}

            <p className="text-base font-medium text-gray-800">
              {t("qr.scanHint")}
            </p>

            <ol className="mt-6 w-full max-w-[460px] list-decimal space-y-2 pl-6 text-left text-base text-gray-700">
              <li>{t("qr.step1")}</li>
              <li>{t("qr.step2")}</li>
              <li>{t("qr.step3")}</li>
            </ol>

            <p className="mt-8 text-sm text-gray-500">{t("qr.urlFallback")}</p>
            <p className="break-all font-mono text-sm text-gray-700">{url}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
