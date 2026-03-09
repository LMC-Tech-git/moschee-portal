"use client";

import { useState, useEffect, useCallback } from "react";
import { Mail, Send, CheckCircle, Clock, AlertCircle, RefreshCw, Inbox } from "lucide-react";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { sendNewsletter } from "@/lib/actions/newsletter";
import { processNewsletterQueue, getEmailQueueStats } from "@/lib/actions/email";
import type { NewsletterInput } from "@/lib/validations";

const segmentOptions = [
  { value: "all", label: "Alle Mitglieder" },
  { value: "active", label: "Nur aktive Mitglieder" },
  { value: "admins", label: "Nur Admins" },
] as const;

interface QueueStats {
  queued: number;
  sent: number;
  failed: number;
}

export default function AdminNewsletterPage() {
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [toSegment, setToSegment] = useState<NewsletterInput["to_segment"]>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [queueStats, setQueueStats] = useState<QueueStats>({ queued: 0, sent: 0, failed: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!mosqueId) return;
    setStatsLoading(true);
    const stats = await getEmailQueueStats(mosqueId);
    setQueueStats(stats);
    setStatsLoading(false);
  }, [mosqueId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function handleQueue() {
    if (!user) return;
    if (!confirm("Newsletter in die Warteschlange stellen?")) return;

    setError("");
    setSuccessMsg("");
    setIsSubmitting(true);

    const result = await sendNewsletter(mosqueId, user.id, {
      subject,
      body_html: bodyHtml,
      to_segment: toSegment,
    });

    if (result.success && result.data) {
      setSuccessMsg(
        `${result.data.queued} E-Mail(s) in Warteschlange gestellt. Klicke "Jetzt senden" um sie zu versenden.`
      );
      setSubject("");
      setBodyHtml("");
      await loadStats();
    } else {
      setError(result.error || "Ein Fehler ist aufgetreten");
    }

    setIsSubmitting(false);
  }

  async function handleSendQueue() {
    if (!user) return;
    if (queueStats.queued === 0) return;
    if (!confirm(`${queueStats.queued} E-Mail(s) jetzt versenden?`)) return;

    setError("");
    setSuccessMsg("");
    setIsSending(true);

    const result = await processNewsletterQueue(mosqueId, user.id);

    if (result.success) {
      setSuccessMsg(
        `Versand abgeschlossen: ${result.sent} gesendet${result.failed ? `, ${result.failed} fehlgeschlagen` : ""}.`
      );
      await loadStats();
    } else {
      setError(result.error || "Fehler beim Senden");
    }

    setIsSending(false);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Newsletter</h1>
        <p className="text-sm text-gray-500">
          Senden Sie eine Nachricht an Ihre Mitglieder.
        </p>
      </div>

      {/* Warteschlangen-Status */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Inbox className="h-4 w-4 text-gray-500" />
            Warteschlange
          </h2>
          <button
            type="button"
            onClick={loadStats}
            disabled={statsLoading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${statsLoading ? "animate-spin" : ""}`} />
            Aktualisieren
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
            <p className="text-2xl font-bold text-amber-700">{queueStats.queued}</p>
            <p className="text-xs text-amber-600 mt-0.5">Ausstehend</p>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{queueStats.sent}</p>
            <p className="text-xs text-green-600 mt-0.5">Gesendet</p>
          </div>
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{queueStats.failed}</p>
            <p className="text-xs text-red-600 mt-0.5">Fehlgeschlagen</p>
          </div>
        </div>

        {queueStats.queued > 0 && (
          <button
            type="button"
            onClick={handleSendQueue}
            disabled={isSending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                E-Mails werden versendet…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {queueStats.queued} E-Mail(s) jetzt senden
              </>
            )}
          </button>
        )}

        {queueStats.queued === 0 && (
          <p className="text-center text-sm text-gray-400">
            <Clock className="mr-1 inline h-4 w-4" />
            Keine E-Mails in der Warteschlange
          </p>
        )}
      </div>

      {/* Status-Meldungen */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Neuer Newsletter */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-5 text-base font-semibold text-gray-900">Neuen Newsletter erstellen</h2>
        <div className="space-y-6">
          {/* Empfänger */}
          <div>
            <label htmlFor="segment" className="mb-1.5 block text-sm font-medium text-gray-700">
              <Mail className="mr-1 inline h-3.5 w-3.5" />
              Empfänger
            </label>
            <select
              id="segment"
              value={toSegment}
              onChange={(e) => setToSegment(e.target.value as NewsletterInput["to_segment"])}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {segmentOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Betreff */}
          <div>
            <label htmlFor="subject" className="mb-1.5 block text-sm font-medium text-gray-700">
              Betreff *
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Betreff der E-Mail"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Inhalt */}
          <div>
            <label htmlFor="body" className="mb-1.5 block text-sm font-medium text-gray-700">
              Inhalt (HTML) *
            </label>
            <textarea
              id="body"
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="<p>Liebe Gemeinde,</p><p>...</p>"
              rows={12}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 font-mono text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Button */}
          <div className="flex gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={handleQueue}
              disabled={isSubmitting || !subject || !bodyHtml}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Clock className="h-4 w-4" />
              {isSubmitting ? "Wird eingereiht…" : "In Warteschlange stellen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
