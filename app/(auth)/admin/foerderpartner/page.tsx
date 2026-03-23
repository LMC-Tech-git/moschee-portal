"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useMosque } from "@/lib/mosque-context";
import {
  getSponsors,
  createSponsor,
  updateSponsor,
  deleteSponsor,
  toggleSponsorActive,
  markSponsorPaid,
  uploadSponsorLogo,
} from "@/lib/actions/sponsors";
import {
  sponsorCategoryLabels,
  sponsorCategoryColors,
  sponsorCategoryOptions,
} from "@/lib/constants";
import { getMembersByMosque } from "@/lib/actions/members";
import type { Sponsor, SponsorCategory, User } from "@/types";
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  Upload,
  Globe,
  AlertCircle,
  X,
  Banknote,
} from "lucide-react";
import { useTranslations } from "next-intl";

const pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "";

function getSponsorLogoUrl(sponsor: Sponsor): string | null {
  if (!sponsor.logo) return null;
  return `${pbUrl}/api/files/sponsors/${sponsor.id}/${sponsor.logo}?thumb=80x80`;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE");
}

function getDaysUntil(iso: string | undefined): number | null {
  if (!iso) return null;
  const end = new Date(iso);
  if (isNaN(end.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface SponsorFormState {
  name: string;
  description: string;
  website_url: string;
  category: SponsorCategory | "";
  amount_cents_eur: string; // user types EUR
  contact_user_id: string;
  contact_email: string;
}

const emptyForm: SponsorFormState = {
  name: "",
  description: "",
  website_url: "",
  category: "",
  amount_cents_eur: "",
  contact_user_id: "",
  contact_email: "",
};

function formToAmountCents(eur: string): number | undefined {
  const v = parseFloat(eur.replace(",", "."));
  if (isNaN(v) || v <= 0) return undefined;
  return Math.round(v * 100);
}

// ─── Paid Dialog state ────────────────────────────────────────────────────────

interface PaidDialogState {
  sponsorId: string;
  sponsorName: string;
  method: "cash" | "transfer";
  durationMonths: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminFoerderpartnerPage() {
  const { user } = useAuth();
  const { mosqueId } = useMosque();
  const t = useTranslations("sponsors.admin");

  // Data
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Create/Edit Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSponsor, setEditSponsor] = useState<Sponsor | null>(null);
  const [form, setForm] = useState<SponsorFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Paid Dialog
  const [paidDialog, setPaidDialog] = useState<PaidDialogState | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  // Members for contact dropdown
  const [members, setMembers] = useState<User[]>([]);

  // In-flight action trackers
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Logo file inputs (hidden, one per row)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ─── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mosqueId) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosqueId]);

  async function loadData() {
    setIsLoading(true);
    setError("");
    const result = await getSponsors(mosqueId!);
    if (result.success && result.data) {
      setSponsors(result.data);
    } else {
      setError(result.error ?? "Fehler beim Laden.");
    }
    setIsLoading(false);
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  }

  // ─── Create / Edit Dialog ──────────────────────────────────────────────────

  async function loadMembers() {
    if (!mosqueId || members.length > 0) return;
    const result = await getMembersByMosque(mosqueId, { status: "active", limit: 200 });
    if (result.success && result.data) setMembers(result.data);
  }

  function openCreateDialog() {
    setEditSponsor(null);
    setForm(emptyForm);
    setFormError("");
    setDialogOpen(true);
    loadMembers();
  }

  function openEditDialog(sponsor: Sponsor) {
    setEditSponsor(sponsor);
    setForm({
      name: sponsor.name,
      description: sponsor.description ?? "",
      website_url: sponsor.website_url ?? "",
      category: sponsor.category ?? "",
      amount_cents_eur: sponsor.amount_cents ? (sponsor.amount_cents / 100).toFixed(2) : "",
      contact_user_id: sponsor.contact_user_id ?? "",
      contact_email: sponsor.contact_email ?? "",
    });
    setFormError("");
    setDialogOpen(true);
    loadMembers();
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditSponsor(null);
    setForm(emptyForm);
    setFormError("");
  }

  async function handleSave() {
    if (!user || !mosqueId) return;
    if (!form.name.trim()) {
      setFormError("Name ist erforderlich.");
      return;
    }
    if (form.description.length > 300) {
      setFormError("Beschreibung darf max. 300 Zeichen lang sein.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    const amount_cents = formToAmountCents(form.amount_cents_eur);
    const input = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      website_url: form.website_url.trim() || undefined,
      category: (form.category || undefined) as SponsorCategory | undefined,
      amount_cents,
      contact_user_id: form.contact_user_id || undefined,
      contact_email: form.contact_email.trim() || undefined,
    };

    let result;
    if (editSponsor) {
      result = await updateSponsor(mosqueId, user.id, editSponsor.id, input);
    } else {
      result = await createSponsor(mosqueId, user.id, input);
    }

    setIsSaving(false);

    if (result.success) {
      await loadData();
      showSuccess(editSponsor ? t("updateSuccess") : t("createSuccess"));
      closeDialog();
    } else {
      setFormError(result.error ?? "Fehler beim Speichern.");
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(sponsor: Sponsor) {
    if (!user || !mosqueId) return;
    if (!confirm(t("confirmDelete"))) return;
    setDeletingId(sponsor.id);
    const result = await deleteSponsor(mosqueId, user.id, sponsor.id);
    if (result.success) {
      await loadData();
      showSuccess(t("deleteSuccess"));
    } else {
      setError(result.error ?? "Fehler beim Löschen.");
    }
    setDeletingId(null);
  }

  // ─── Toggle Active ─────────────────────────────────────────────────────────

  async function handleToggleActive(sponsor: Sponsor) {
    if (!user || !mosqueId) return;
    setTogglingId(sponsor.id);
    const result = await toggleSponsorActive(mosqueId, user.id, sponsor.id, !sponsor.is_active);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Fehler.");
    }
    setTogglingId(null);
  }

  // ─── Mark Paid ────────────────────────────────────────────────────────────

  function openPaidDialog(sponsor: Sponsor) {
    setPaidDialog({
      sponsorId: sponsor.id,
      sponsorName: sponsor.name,
      method: "cash",
      durationMonths: 12,
    });
  }

  async function handleMarkPaid() {
    if (!paidDialog || !user || !mosqueId) return;
    setIsPaying(true);
    const result = await markSponsorPaid(
      mosqueId,
      user.id,
      paidDialog.sponsorId,
      paidDialog.method,
      paidDialog.durationMonths
    );
    setIsPaying(false);
    if (result.success && result.data) {
      await loadData();
      const endFormatted = formatDate(result.data.end_date);
      showSuccess(t("paidSuccess", { end: endFormatted }));
      setPaidDialog(null);
    } else {
      setError(result.error ?? "Fehler beim Speichern.");
      setPaidDialog(null);
    }
  }

  // ─── Logo Upload ──────────────────────────────────────────────────────────

  async function handleLogoUpload(sponsor: Sponsor, file: File) {
    if (!user || !mosqueId) return;
    setUploadingId(sponsor.id);
    const fd = new FormData();
    fd.append("logo", file);
    const result = await uploadSponsorLogo(mosqueId, user.id, sponsor.id, fd);
    if (result.success) {
      await loadData();
    } else {
      setError(result.error ?? "Fehler beim Hochladen.");
    }
    setUploadingId(null);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">
            {t("subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateDialog}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          {t("add")}
        </button>
      </div>

      {/* Global messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          </div>
        ) : sponsors.length === 0 ? (
          <div className="py-16 text-center">
            <Banknote className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">{t("empty")}</p>
            <button
              type="button"
              onClick={openCreateDialog}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              {t("add")}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">{t("logo")}</th>
                  <th className="px-4 py-3">{t("name")}</th>
                  <th className="px-4 py-3 hidden md:table-cell">Zahlung</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Laufzeit</th>
                  <th className="px-4 py-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sponsors.map((sponsor) => {
                  const logoUrl = getSponsorLogoUrl(sponsor);
                  const daysUntil = getDaysUntil(sponsor.end_date);
                  const isExpired = daysUntil !== null && daysUntil < 0;
                  const isExpiringSoon = daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;
                  const hasPeriod = sponsor.start_date || sponsor.end_date;

                  return (
                    <tr key={sponsor.id} className="transition-colors hover:bg-gray-50">
                      {/* Logo */}
                      <td className="px-4 py-3">
                        <div className="relative h-10 w-10">
                          {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={logoUrl}
                              alt={sponsor.name}
                              className="h-10 w-10 rounded-md object-contain border border-gray-200 bg-white p-0.5"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-gray-300">
                              <Banknote className="h-4 w-4" />
                            </div>
                          )}
                          {/* Hidden file input */}
                          <input
                            ref={(el) => { fileInputRefs.current[sponsor.id] = el; }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleLogoUpload(sponsor, file);
                              e.target.value = "";
                            }}
                          />
                        </div>
                      </td>

                      {/* Name + category */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-gray-900">{sponsor.name}</span>
                          {sponsor.category && sponsorCategoryLabels[sponsor.category] && (
                            <span
                              className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
                                sponsorCategoryColors[sponsor.category] ?? "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {sponsorCategoryLabels[sponsor.category]}
                            </span>
                          )}
                          {sponsor.website_url && (
                            <a
                              href={/^https?:\/\//i.test(sponsor.website_url) ? sponsor.website_url : `https://${sponsor.website_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                              <Globe className="h-3 w-3" />
                              {sponsor.website_url.replace(/^https?:\/\//, "").split("/")[0]}
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Payment status */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {sponsor.payment_status === "paid" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <CheckCircle className="h-3 w-3" />
                            {t("paymentPaid")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {t("paymentOpen")}
                          </span>
                        )}
                        {sponsor.amount_cents && sponsor.amount_cents > 0 ? (
                          <p className="mt-0.5 text-xs text-gray-400">
                            {(sponsor.amount_cents / 100).toLocaleString("de-DE", {
                              style: "currency",
                              currency: "EUR",
                            })}
                          </p>
                        ) : null}
                      </td>

                      {/* Active badge */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {sponsor.is_active ? (
                          <span className="inline-flex w-fit rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            {t("active")}
                          </span>
                        ) : (
                          <span className="inline-flex w-fit rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            {t("inactive")}
                          </span>
                        )}
                      </td>

                      {/* Period + expiry */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {hasPeriod ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-600">
                              {formatDate(sponsor.start_date)} – {formatDate(sponsor.end_date) || "–"}
                            </span>
                            {isExpired && (
                              <span className="inline-flex w-fit rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                {t("expiredLabel")}
                              </span>
                            )}
                            {isExpiringSoon && !isExpired && (
                              <span className="inline-flex w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                {t("expiresIn", { days: daysUntil })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {/* Logo upload */}
                          <button
                            type="button"
                            onClick={() => fileInputRefs.current[sponsor.id]?.click()}
                            disabled={uploadingId === sponsor.id}
                            title={t("uploadLogo")}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                          >
                            {uploadingId === sponsor.id ? (
                              <span className="h-3 w-3 inline-block animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                            ) : (
                              <Upload className="h-3 w-3" />
                            )}
                            <span className="hidden sm:inline">{t("uploadLogo")}</span>
                          </button>

                          {/* Activate / Deactivate */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(sponsor)}
                            disabled={togglingId === sponsor.id}
                            title={sponsor.is_active ? t("deactivate") : t("activate")}
                            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                              sponsor.is_active
                                ? "text-orange-600 hover:bg-orange-50"
                                : "text-blue-700 hover:bg-blue-50"
                            }`}
                          >
                            {togglingId === sponsor.id ? (
                              <span className="h-3 w-3 inline-block animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                            ) : null}
                            <span className="hidden md:inline">
                              {sponsor.is_active ? t("deactivate") : t("activate")}
                            </span>
                          </button>

                          {/* Mark Paid */}
                          <button
                            type="button"
                            onClick={() => openPaidDialog(sponsor)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                            title={t("markPaid")}
                          >
                            <Banknote className="h-3 w-3" />
                            <span className="hidden md:inline">{t("markPaid")}</span>
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => openEditDialog(sponsor)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                            title={t("edit")}
                          >
                            <Pencil className="h-3 w-3" />
                            <span className="hidden md:inline">{t("edit")}</span>
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(sponsor)}
                            disabled={deletingId === sponsor.id}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                            title={t("delete")}
                          >
                            {deletingId === sponsor.id ? (
                              <span className="h-3 w-3 inline-block animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            <span className="hidden md:inline">{t("delete")}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Create / Edit Dialog ─────────────────────────────────────────── */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            {/* Dialog header */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editSponsor ? t("edit") : t("add")}
              </h2>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Dialog body */}
            <div className="space-y-4 px-6 py-5">
              {formError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {formError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("name")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t("namePlaceholder")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("description")}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t("descriptionPlaceholder")}
                  maxLength={300}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="mt-1 text-right text-xs text-gray-400">
                  {form.description.length} / 300
                </p>
              </div>

              {/* Website */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("website")}
                </label>
                <input
                  type="url"
                  value={form.website_url}
                  onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
                  placeholder={t("websitePlaceholder")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Category + Amount — 2 columns */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("category")}
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value as SponsorCategory | "" }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">{t("categoryNone")}</option>
                    {sponsorCategoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("amount")}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.50"
                      value={form.amount_cents_eur}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, amount_cents_eur: e.target.value }))
                      }
                      placeholder={t("amountPlaceholder")}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-7 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      €
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact — separator */}
              <div className="border-t pt-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {t("contactSection")}
                </p>

                {/* Portal member dropdown */}
                <div className="mb-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("contactUser")}
                  </label>
                  <select
                    value={form.contact_user_id}
                    onChange={(e) => {
                      const uid = e.target.value;
                      const member = members.find((m) => m.id === uid);
                      setForm((f) => ({
                        ...f,
                        contact_user_id: uid,
                        contact_email: member ? member.email : f.contact_email,
                      }));
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">{t("contactUserPlaceholder")}</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Contact email */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("contactEmail")}
                  </label>
                  <input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                    placeholder={t("contactEmailPlaceholder")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="mt-1 text-xs text-gray-400">{t("contactEmailHint")}</p>
                </div>
              </div>
            </div>

            {/* Dialog footer */}
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {isSaving && (
                  <span className="h-4 w-4 inline-block animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {isSaving ? "Speichern…" : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Mark Paid Dialog ─────────────────────────────────────────────── */}
      {paidDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">{t("markPaid")}</h2>
              <button
                type="button"
                onClick={() => setPaidDialog(null)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-gray-700">
                Zahlung erfassen für{" "}
                <strong className="font-semibold">{paidDialog.sponsorName}</strong>
              </p>

              {/* Payment method */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Zahlungsart
                </label>
                <div className="flex gap-3">
                  {(["cash", "transfer"] as const).map((method) => (
                    <label key={method} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="payment_method"
                        value={method}
                        checked={paidDialog.method === method}
                        onChange={() =>
                          setPaidDialog((d) => d ? { ...d, method } : d)
                        }
                        className="accent-emerald-600"
                      />
                      <span className="text-sm text-gray-700">
                        {method === "cash" ? t("paymentCash") : t("paymentTransfer")}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("durationMonths")}
                </label>
                <select
                  value={paidDialog.durationMonths}
                  onChange={(e) =>
                    setPaidDialog((d) =>
                      d ? { ...d, durationMonths: Number(e.target.value) } : d
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value={1}>{t("duration1")}</option>
                  <option value={3}>{t("duration3")}</option>
                  <option value={6}>{t("duration6")}</option>
                  <option value={12}>{t("duration12")}</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <button
                type="button"
                onClick={() => setPaidDialog(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleMarkPaid}
                disabled={isPaying}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {isPaying && (
                  <span className="h-4 w-4 inline-block animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {isPaying ? "Speichern…" : "Zahlung speichern"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
