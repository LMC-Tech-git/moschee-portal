"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { useSearchParams } from "next/navigation";
import { useMosque } from "@/lib/mosque-context";
import {
  updateProfile,
  requestEmailChange,
  getMemberDonations,
  getMemberEventHistory,
} from "@/lib/actions/members";
import { cancelMemberRegistration } from "@/lib/actions/events";
import { getStudentsByParent } from "@/lib/actions/students";
import { AddChildDialog } from "@/components/madrasa/AddChildDialog";
import type { Student } from "@/types";
import {
  getParentFeeOverview,
  createFeeStripeCheckout,
  createMultiMonthFeeCheckout,
  type FeeOverviewRow,
} from "@/lib/actions/student-fees";
import { getMadrasaFeeSettings, getPortalSettings } from "@/lib/actions/settings";
import { getSponsorsByContact, createSponsorStripeCheckout } from "@/lib/actions/sponsors";
import type { Sponsor } from "@/types";
import { DemoHint } from "@/components/demo/DemoHint";
import {
  User,
  Mail,
  Phone,
  Hash,
  CheckCircle,
  Banknote,
  CalendarDays,
  Clock,
  XCircle,
  FileText,
  GraduationCap,
  Handshake,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Baby,
  Plus,
  MapPin,
  Pencil,
} from "lucide-react";
import { formatCurrencyCents } from "@/lib/utils";
import type { Donation, EventRegistration } from "@/types";

type Tab = "profile" | "children" | "donations" | "events" | "madrasa" | "sponsor";

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthKey(monthKey: string, locale?: string): string {
  const [y, m] = monthKey.split("-");
  const intlLocale = locale === "tr" ? "tr-TR" : "de-DE";
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(intlLocale, {
    month: "long",
    year: "numeric",
  });
}

function prevMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MemberProfilePage() {
  const t = useTranslations();
  const { user, refreshUser } = useAuth();
  const { mosqueId, mosque } = useMosque();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [feesEnabled, setFeesEnabled] = useState(false);
  const [sponsorsEnabled, setSponsorsEnabled] = useState(false);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [emailChangedSuccess, setEmailChangedSuccess] = useState(false);
  const [emailChangedError, setEmailChangedError] = useState("");

  // URL-Params auswerten (E-Mail-Bestätigung, Deep-Links aus Fee-Reminder etc.)
  useEffect(() => {
    const changed = searchParams.get("email_changed");
    const err = searchParams.get("email_error");
    const tabParam = searchParams.get("tab");

    if (changed === "true") {
      setEmailChangedSuccess(true);
      setActiveTab("profile");
      refreshUser();
      window.history.replaceState({}, "", "/member/profile");
    } else if (err) {
      const msgs: Record<string, string> = {
        invalid: t("member.profile.emailChange.errorInvalid"),
        expired: t("member.profile.emailChange.errorExpired"),
        taken: t("member.profile.emailChange.errorTaken"),
        server: t("member.profile.emailChange.errorServer"),
      };
      setEmailChangedError(msgs[err] || t("member.profile.emailChange.errorServer"));
      setActiveTab("profile");
      window.history.replaceState({}, "", "/member/profile");
    } else if (tabParam && ["profile", "children", "donations", "events", "madrasa", "sponsor"].includes(tabParam)) {
      setActiveTab(tabParam as Tab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mosqueId || !user) return;
    const userId = user.id;
    async function checkSettings() {
      const [feeResult, portalResult] = await Promise.all([
        getMadrasaFeeSettings(mosqueId),
        getPortalSettings(mosqueId),
      ]);
      if (feeResult.success && feeResult.data?.madrasa_fees_enabled) {
        setFeesEnabled(true);
      }
      if (portalResult.success && portalResult.settings?.sponsors_enabled) {
        const sponsorResult = await getSponsorsByContact(mosqueId, userId);
        if (sponsorResult.success && sponsorResult.data && sponsorResult.data.length > 0) {
          setSponsorsEnabled(true);
        }
      }
    }
    checkSettings();
  }, [mosqueId, user]);

  useEffect(() => {
    if (mosque?.donation_provider === "stripe") {
      setStripeEnabled(true);
    }
  }, [mosque]);

  if (!user) return null;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "profile", label: t("member.profile.tab.profile"), icon: <User className="h-4 w-4" /> },
    { key: "children", label: t("member.profile.tab.children"), icon: <Baby className="h-4 w-4" /> },
    {
      key: "donations",
      label: t("member.profile.tab.donations"),
      icon: <Banknote className="h-4 w-4" />,
    },
    {
      key: "events",
      label: t("member.profile.tab.events"),
      icon: <CalendarDays className="h-4 w-4" />,
    },
    ...(feesEnabled
      ? [{ key: "madrasa" as Tab, label: t("member.profile.tab.madrasa"), icon: <GraduationCap className="h-4 w-4" /> }]
      : []),
    ...(sponsorsEnabled
      ? [{ key: "sponsor" as Tab, label: t("member.profile.tab.sponsor"), icon: <Handshake className="h-4 w-4" /> }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <DemoHint
        id="member-profile"
        title={t("member.profile.hint.title")}
        description={t("member.profile.hint.desc")}
        className="mb-6"
      />
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{t("member.profile.title")}</h1>

      {/* Info-Karte */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <User className="h-8 w-8 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">
              {user.full_name}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
              <span className="flex min-w-0 items-center gap-1">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[180px] truncate sm:max-w-none">{user.email}</span>
              </span>
              {user.member_no && (
                <span className="flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" />
                  {user.member_no}
                </span>
              )}
            </div>
            <div className="mt-1 flex gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  user.status === "active"
                    ? "bg-green-100 text-green-700"
                    : user.status === "blocked"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                }`}
              >
                {user.status === "active"
                  ? t("member.profile.status.active")
                  : user.status === "blocked"
                    ? t("member.profile.status.blocked")
                    : t("member.profile.status.pending")}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {user.role === "admin" ? t("member.profile.role.admin") : t("member.profile.role.member")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm ${
                activeTab === tab.key
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              <span className="sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* E-Mail-Änderung Rückmeldungen */}
      {emailChangedSuccess && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {t("member.profile.emailChange.successMessage")}
        </div>
      )}
      {emailChangedError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {emailChangedError}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "profile" && <ProfileEditForm user={user} />}
      {activeTab === "children" && (
        <ChildrenTab userId={user.id} userName={`${user.first_name} ${user.last_name}`.trim()} userPhone={user.phone} userAddress={user.address || ""} mosqueId={mosqueId} />
      )}
      {activeTab === "donations" && (
        <DonationHistory userId={user.id} mosqueId={mosqueId} />
      )}
      {activeTab === "events" && (
        <EventHistory userId={user.id} mosqueId={mosqueId} />
      )}
      {activeTab === "madrasa" && (
        <MadrasaFeeOverview userId={user.id} mosqueId={mosqueId} stripeEnabled={stripeEnabled} initialMonth={searchParams.get("month") || undefined} />
      )}
      {activeTab === "sponsor" && (
        <SponsorPaymentOverview userId={user.id} mosqueId={mosqueId} stripeEnabled={stripeEnabled} sponsorPaidSuccess={searchParams.get("sponsor_paid") === "true"} />
      )}
    </div>
  );
}

// --- Profil bearbeiten ---

function ProfileEditForm({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  const t = useTranslations();
  const { refreshUser } = useAuth();
  const [firstName, setFirstName] = useState(user.first_name || "");
  const [lastName, setLastName] = useState(user.last_name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [address, setAddress] = useState(user.address || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Formular-State mit frischen User-Daten synchronisieren (z.B. nach refreshUser)
  useEffect(() => {
    setFirstName(user.first_name || "");
    setLastName(user.last_name || "");
    setPhone(user.phone || "");
    setAddress(user.address || "");
  }, [user.first_name, user.last_name, user.phone, user.address]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      setError(t("member.profile.phone") + " ist erforderlich");
      return;
    }
    setError("");
    setSuccess(false);
    setIsSubmitting(true);

    const result = await updateProfile(user.id, {
      first_name: firstName,
      last_name: lastName,
      phone,
      address,
    });

    if (result.success) {
      // Auth-State mit frischen Daten aus PocketBase aktualisieren,
      // damit Name/Telefon sofort überall im Portal korrekt angezeigt werden
      await refreshUser();
      setSuccess(true);
    } else {
      setError(result.error || "Ein Fehler ist aufgetreten");
    }

    setIsSubmitting(false);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-bold text-gray-900">
        {t("member.profile.editTitle")}
      </h2>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" />
          {t("member.profile.savedSuccess")}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="firstName"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              {t("member.profile.firstName")}
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label
              htmlFor="lastName"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              {t("member.profile.lastName")}
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="phone"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            <Phone className="mr-1 inline h-3.5 w-3.5" />
            {t("member.profile.phone")}
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+49 ..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label
            htmlFor="address"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            <MapPin className="mr-1 inline h-3.5 w-3.5" />
            {t("member.profile.address")}
          </label>
          <textarea
            id="address"
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t("member.profile.addressPlaceholder")}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="border-t border-gray-200 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? t("member.profile.saving") : t("member.profile.saveProfile")}
          </button>
        </div>
      </form>

      <EmailChangeSection userId={user.id} currentEmail={user.email} />
    </div>
  );
}

// --- E-Mail-Adresse ändern ---

function EmailChangeSection({
  userId,
  currentEmail,
}: {
  userId: string;
  currentEmail: string;
}) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await requestEmailChange(userId, newEmail);

    if (result.success) {
      setSent(true);
      setNewEmail("");
    } else {
      setError(result.error || t("member.profile.emailChange.errorServer"));
    }

    setIsSubmitting(false);
  }

  function handleOpen() {
    setIsOpen(true);
    setSent(false);
    setError("");
    setNewEmail("");
  }

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">
            {t("member.profile.emailChange.title")}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
            <Mail className="h-3.5 w-3.5" />
            {currentEmail}
          </p>
        </div>
        {!isOpen && (
          <button
            type="button"
            onClick={handleOpen}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("member.profile.emailChange.changeButton")}
          </button>
        )}
      </div>

      {isOpen && !sent && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="newEmail"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              {t("member.profile.emailChange.newEmailLabel")}
            </label>
            <input
              id="newEmail"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t("member.profile.emailChange.newEmailPlaceholder")}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting || !newEmail}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? t("member.profile.emailChange.sending")
                : t("member.profile.emailChange.sendConfirmation")}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("member.profile.emailChange.cancel")}
            </button>
          </div>
        </form>
      )}

      {sent && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{t("member.profile.emailChange.sentTitle")}</p>
            <p className="mt-0.5 text-emerald-600">{t("member.profile.emailChange.sentDesc")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Kinder-Tab ---

function ChildrenTab({
  userId,
  userName,
  userPhone,
  userAddress,
  mosqueId,
}: {
  userId: string;
  userName: string;
  userPhone: string;
  userAddress: string;
  mosqueId: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [children, setChildren] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editChild, setEditChild] = useState<Student | null>(null);

  async function loadChildren() {
    setIsLoading(true);
    const result = await getStudentsByParent(userId, mosqueId);
    if (result.success && result.data) setChildren(result.data);
    setIsLoading(false);
  }

  useEffect(() => {
    loadChildren();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mosqueId]);

  const intlLocale = locale === "tr" ? "tr-TR" : "de-DE";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">{t("member.profile.children.title")}</h2>
        <button
          onClick={() => setShowDialog(true)}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t("member.profile.children.addButton")}
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-gray-400">...</div>
      ) : children.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">
          {t("member.profile.children.empty")}
        </div>
      ) : (
        <div className="space-y-3">
          {children.map((child) => (
            <div key={child.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
                  <Baby className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">
                    {child.first_name} {child.last_name}
                  </p>
                  <div className="flex flex-wrap gap-x-3 text-xs text-gray-500">
                    {child.date_of_birth && (
                      <span>
                        {t("member.profile.children.dob")}: {new Date(child.date_of_birth).toLocaleDateString(intlLocale)}
                      </span>
                    )}
                    {child.school_name && (
                      <span>{t("member.profile.children.school")}: {child.school_name}</span>
                    )}
                    {child.school_class && (
                      <span>{t("member.profile.children.class")}: {child.school_class}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setEditChild(child)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                  title={t("member.profile.children.editButton")}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddChildDialog
        open={showDialog}
        parentId={userId}
        parentName={userName}
        parentPhone={userPhone}
        parentAddress={userAddress}
        onClose={() => setShowDialog(false)}
        onSuccess={loadChildren}
      />

      <AddChildDialog
        open={!!editChild}
        parentId={userId}
        parentName={userName}
        parentPhone={userPhone}
        parentAddress={userAddress}
        student={editChild}
        onClose={() => setEditChild(null)}
        onSuccess={loadChildren}
      />
    </div>
  );
}

// --- Spendenhistorie ---

function DonationHistory({
  userId,
  mosqueId,
}: {
  userId: string;
  mosqueId: string;
}) {
  const t = useTranslations();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const result = await getMemberDonations(userId, mosqueId);
      if (result.success && result.data) {
        setDonations(result.data);
      }
      setIsLoading(false);
    }
    load();
  }, [userId, mosqueId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  const paidDonations = donations.filter((d) => d.status === "paid");
  const totalPaid = paidDonations.reduce(
    (sum, d) => sum + d.amount_cents,
    0
  );

  return (
    <div className="space-y-4">
      {/* Gesamtsumme */}
      {paidDonations.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className="text-sm text-emerald-700">{t("member.donations.totalLabel")}</p>
          <p className="text-2xl font-bold text-emerald-800">
            {formatCurrencyCents(totalPaid)}
          </p>
          <Link
            href="/member/spendenbescheinigung"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <FileText className="h-4 w-4" />
            {t("member.donations.certificate")}
          </Link>
        </div>
      )}

      {/* Liste */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {donations.length === 0 ? (
          <div className="py-12 text-center">
            <Banknote className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">{t("member.donations.noDonations")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {donations.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {formatCurrencyCents(d.amount_cents)}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>
                      {d.created
                        ? new Date(d.created).toLocaleDateString("de-DE")
                        : "—"}
                    </span>
                    {d.is_recurring && (
                      <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                        {t("member.donations.monthly")}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    d.status === "paid"
                      ? "bg-green-50 text-green-700"
                      : d.status === "pending"
                        ? "bg-amber-50 text-amber-700"
                        : d.status === "failed" || d.status === "cancelled"
                          ? "bg-red-50 text-red-700"
                          : "bg-gray-50 text-gray-700"
                  }`}
                >
                  {d.status === "paid"
                    ? t("member.donations.status.paid")
                    : d.status === "pending"
                      ? t("member.donations.status.pending")
                      : d.status === "failed"
                        ? t("member.donations.status.failed")
                        : d.status === "cancelled"
                          ? t("member.donations.status.cancelled")
                          : d.status === "refunded"
                            ? t("member.donations.status.refunded")
                            : t("member.donations.status.created")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Event-Teilnahmehistorie ---

function EventHistory({
  userId,
  mosqueId,
}: {
  userId: string;
  mosqueId: string;
}) {
  const t = useTranslations();
  const [events, setEvents] = useState<
    (EventRegistration & { event_title?: string; event_start_at?: string })[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const result = await getMemberEventHistory(userId, mosqueId);
      if (result.success && result.data) {
        setEvents(result.data);
      }
      setIsLoading(false);
    }
    load();
  }, [userId, mosqueId]);

  async function handleCancel(regId: string, eventId: string) {
    if (!confirm(t("member.events.cancelConfirm"))) return;
    setCancellingId(regId);
    const result = await cancelMemberRegistration(eventId, userId, mosqueId);
    if (result.success) {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === regId ? { ...e, status: "cancelled" as const } : e
        )
      );
    }
    setCancellingId(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {events.length === 0 ? (
        <div className="py-12 text-center">
          <CalendarDays className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">
            {t("member.events.noEvents")}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {events.map((reg) => (
            <div
              key={reg.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {reg.event_title || "Veranstaltung"}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {reg.event_start_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(reg.event_start_at).toLocaleDateString(
                        "de-DE",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    reg.status === "registered"
                      ? "bg-blue-50 text-blue-700"
                      : reg.status === "attended"
                        ? "bg-green-50 text-green-700"
                        : reg.status === "cancelled"
                          ? "bg-red-50 text-red-700"
                          : "bg-gray-50 text-gray-700"
                  }`}
                >
                  {reg.status === "registered" ? (
                    <>
                      <CheckCircle className="h-3 w-3" />
                      {t("member.events.status.registered")}
                    </>
                  ) : reg.status === "attended" ? (
                    <>
                      <CheckCircle className="h-3 w-3" />
                      {t("member.events.status.attended")}
                    </>
                  ) : reg.status === "cancelled" ? (
                    <>
                      <XCircle className="h-3 w-3" />
                      {t("member.events.status.cancelled")}
                    </>
                  ) : (
                    t("member.events.status.noShow")
                  )}
                </span>
                {reg.status === "registered" &&
                  (!reg.event_start_at ||
                    new Date(reg.event_start_at) > new Date()) && (
                    <button
                      onClick={() => handleCancel(reg.id, reg.event_id)}
                      disabled={cancellingId === reg.id}
                      className="rounded border border-red-200 px-2 py-0.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      {cancellingId === reg.id
                        ? "…"
                        : t("member.events.cancelBtn")}
                    </button>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Madrasa-Gebühren ---

function MadrasaFeeOverview({
  userId,
  mosqueId,
  stripeEnabled,
  initialMonth,
}: {
  userId: string;
  mosqueId: string;
  stripeEnabled: boolean;
  initialMonth?: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [monthKey, setMonthKey] = useState(initialMonth && /^\d{4}-\d{2}$/.test(initialMonth) ? initialMonth : getCurrentMonthKey());
  const [rows, setRows] = useState<FeeOverviewRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payingFeeId, setPayingFeeId] = useState<string | null>(null);
  const [prepayMonths, setPrepayMonths] = useState(1);
  const [isPrePaying, setIsPrePaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError("");
      const result = await getParentFeeOverview(mosqueId, userId, monthKey);
      if (result.success && result.data) {
        setRows(result.data);
      } else {
        setError(result.error || "Fehler beim Laden");
      }
      setIsLoading(false);
    }
    load();
  }, [userId, mosqueId, monthKey]);

  async function handleOnlinePay(feeId: string) {
    setPayingFeeId(feeId);
    setError("");
    const baseUrl = window.location.origin;
    const result = await createFeeStripeCheckout(mosqueId, userId, feeId, "", baseUrl);
    if (result.success && result.data?.checkout_url) {
      window.location.href = result.data.checkout_url;
    } else {
      setError(result.error || "Zahlung konnte nicht gestartet werden");
      setPayingFeeId(null);
    }
  }

  async function handlePrepay() {
    setIsPrePaying(true);
    setError("");
    const baseUrl = window.location.origin;
    const result = await createMultiMonthFeeCheckout(mosqueId, userId, monthKey, prepayMonths, baseUrl);
    if (result.success && result.data?.checkout_url) {
      window.location.href = result.data.checkout_url;
    } else {
      setError(result.error || "Zahlung konnte nicht gestartet werden");
      setIsPrePaying(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Monat-Navigation */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
        <button
          type="button"
          onClick={() => setMonthKey(prevMonthKey(monthKey))}
          className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50"
          aria-label={t("member.madrasa.prevMonth")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-base font-semibold text-gray-900">{formatMonthKey(monthKey, locale)}</span>
        <button
          type="button"
          onClick={() => setMonthKey(nextMonthKey(monthKey))}
          className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50"
          aria-label={t("member.madrasa.nextMonth")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center">
            <GraduationCap className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">{t("member.madrasa.noChildren")}</p>
            <p className="mt-1 text-xs text-gray-400">
              {t("member.madrasa.noChildrenHint")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((row) => (
              <div key={row.student.id} className="flex items-center justify-between px-4 py-4">
                <div>
                  <p className="font-medium text-gray-900">
                    {row.student.first_name} {row.student.last_name}
                  </p>
                  {row.fee && (
                    <p className="mt-0.5 text-sm text-gray-500">
                      {formatCurrencyCents(row.fee.amount_cents)}
                      {row.fee.payment_method === "cash" && ` · ${t("member.madrasa.fee.cash")}`}
                      {row.fee.payment_method === "transfer" && ` · ${t("member.madrasa.fee.transfer")}`}
                      {row.fee.payment_method === "stripe" && ` · ${t("member.madrasa.fee.online")}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!row.fee ? (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                      {t("member.madrasa.fee.noEntry")}
                    </span>
                  ) : row.fee.status === "paid" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      <CheckCircle className="h-3 w-3" />
                      {t("member.madrasa.fee.paid")}
                    </span>
                  ) : row.fee.status === "waived" ? (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                      {t("member.madrasa.fee.waived")}
                    </span>
                  ) : (
                    <>
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        {t("member.madrasa.fee.open")}
                      </span>
                      {stripeEnabled && row.fee && (
                        <button
                          type="button"
                          onClick={() => handleOnlinePay(row.fee!.id)}
                          disabled={payingFeeId === row.fee!.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {payingFeeId === row.fee!.id ? "Weiterleiten..." : t("member.madrasa.fee.payOnline")}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vorauszahlung */}
      {stripeEnabled && rows.length > 0 && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="mb-3 text-sm font-semibold text-emerald-800">{t("member.madrasa.prepay.title")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={prepayMonths}
              onChange={(e) => setPrepayMonths(Number(e.target.value))}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value={1}>{t("member.madrasa.prepay.1")}</option>
              <option value={3}>{t("member.madrasa.prepay.3")}</option>
              <option value={6}>{t("member.madrasa.prepay.6")}</option>
              <option value={12}>{t("member.madrasa.prepay.12")}</option>
            </select>
            <button
              type="button"
              onClick={handlePrepay}
              disabled={isPrePaying}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {isPrePaying ? "Weiterleiten..." : t("member.madrasa.prepay.button")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Förderpartner-Zahlung ---

function SponsorPaymentOverview({
  userId,
  mosqueId,
  stripeEnabled,
  sponsorPaidSuccess,
}: {
  userId: string;
  mosqueId: string;
  stripeEnabled: boolean;
  sponsorPaidSuccess?: boolean;
}) {
  const t = useTranslations();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [sponsorMonths, setSponsorMonths] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const result = await getSponsorsByContact(mosqueId, userId);
      if (result.success && result.data) {
        setSponsors(result.data);
      } else {
        setError(result.error || "Fehler beim Laden");
      }
      setIsLoading(false);
    }
    load();
  }, [userId, mosqueId]);

  async function handleOnlinePay(sponsorId: string) {
    setPayingId(sponsorId);
    setError("");
    const months = sponsorMonths[sponsorId] || 1;
    const baseUrl = window.location.origin;
    const result = await createSponsorStripeCheckout(mosqueId, userId, sponsorId, baseUrl, months);
    if (result.success && result.data?.checkout_url) {
      window.location.href = result.data.checkout_url;
    } else {
      setError(result.error || "Zahlung konnte nicht gestartet werden");
      setPayingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {sponsorPaidSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {t("member.sponsor.paidSuccess")}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          </div>
        ) : sponsors.length === 0 ? (
          <div className="py-12 text-center">
            <Handshake className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">{t("member.sponsor.empty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sponsors.map((sponsor) => {
              const endDate = sponsor.end_date
                ? new Date(sponsor.end_date).toLocaleDateString("de-DE")
                : null;
              return (
                <div key={sponsor.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-gray-900">{sponsor.name}</span>
                    {endDate && (
                      <span className="text-xs text-gray-400">
                        {t("member.sponsor.until")} {endDate}
                      </span>
                    )}
                    {sponsor.amount_cents && sponsor.amount_cents > 0 ? (
                      <span className="text-xs text-gray-500">
                        {(sponsor.amount_cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {sponsor.payment_status === "paid" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle className="h-3 w-3" />
                        {t("member.sponsor.paid")}
                      </span>
                    ) : (
                      <>
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          {t("member.sponsor.open")}
                        </span>
                        {stripeEnabled && sponsor.amount_cents && sponsor.amount_cents > 0 && (
                          <>
                            <select
                              value={sponsorMonths[sponsor.id] || 1}
                              onChange={(e) => setSponsorMonths((prev) => ({ ...prev, [sponsor.id]: Number(e.target.value) }))}
                              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                              aria-label={t("member.sponsor.months.label")}
                            >
                              <option value={1}>{t("member.madrasa.prepay.1")}</option>
                              <option value={3}>{t("member.madrasa.prepay.3")}</option>
                              <option value={6}>{t("member.madrasa.prepay.6")}</option>
                              <option value={12}>{t("member.madrasa.prepay.12")}</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleOnlinePay(sponsor.id)}
                              disabled={payingId === sponsor.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {payingId === sponsor.id
                                ? "Weiterleiten..."
                                : `${t("member.sponsor.payOnline")} · ${((sponsor.amount_cents * (sponsorMonths[sponsor.id] || 1)) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
