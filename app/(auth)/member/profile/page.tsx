"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useMosque } from "@/lib/mosque-context";
import {
  updateProfile,
  getMemberDonations,
  getMemberEventHistory,
} from "@/lib/actions/members";
import {
  getParentFeeOverview,
  createFeeStripeCheckout,
  type FeeOverviewRow,
} from "@/lib/actions/student-fees";
import { getMadrasaFeeSettings } from "@/lib/actions/settings";
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
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { formatCurrencyCents } from "@/lib/utils";
import type { Donation, EventRegistration } from "@/types";

type Tab = "profile" | "donations" | "events" | "madrasa";

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("de-DE", {
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
  const { user } = useAuth();
  const { mosqueId, mosque } = useMosque();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [feesEnabled, setFeesEnabled] = useState(false);
  const [stripeEnabled, setStripeEnabled] = useState(false);

  useEffect(() => {
    if (!mosqueId) return;
    async function checkFeeSettings() {
      const result = await getMadrasaFeeSettings(mosqueId);
      if (result.success && result.data?.madrasa_fees_enabled) {
        setFeesEnabled(true);
      }
    }
    checkFeeSettings();
  }, [mosqueId]);

  useEffect(() => {
    if (mosque?.donation_provider === "stripe") {
      setStripeEnabled(true);
    }
  }, [mosque]);

  if (!user) return null;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "profile", label: "Profil", icon: <User className="h-4 w-4" /> },
    {
      key: "donations",
      label: "Spenden",
      icon: <Banknote className="h-4 w-4" />,
    },
    {
      key: "events",
      label: "Veranstaltungen",
      icon: <CalendarDays className="h-4 w-4" />,
    },
    ...(feesEnabled
      ? [{ key: "madrasa" as Tab, label: "Madrasa", icon: <GraduationCap className="h-4 w-4" /> }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Mein Profil</h1>

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
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
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
                  ? "Aktiv"
                  : user.status === "blocked"
                    ? "Gesperrt"
                    : "Ausstehend"}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {user.role === "admin" ? "Administrator" : "Mitglied"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "profile" && <ProfileEditForm user={user} />}
      {activeTab === "donations" && (
        <DonationHistory userId={user.id} mosqueId={mosqueId} />
      )}
      {activeTab === "events" && (
        <EventHistory userId={user.id} mosqueId={mosqueId} />
      )}
      {activeTab === "madrasa" && (
        <MadrasaFeeOverview userId={user.id} mosqueId={mosqueId} stripeEnabled={stripeEnabled} />
      )}
    </div>
  );
}

// --- Profil bearbeiten ---

function ProfileEditForm({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  const { refreshUser } = useAuth();
  const [firstName, setFirstName] = useState(user.first_name || "");
  const [lastName, setLastName] = useState(user.last_name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Formular-State mit frischen User-Daten synchronisieren (z.B. nach refreshUser)
  useEffect(() => {
    setFirstName(user.first_name || "");
    setLastName(user.last_name || "");
    setPhone(user.phone || "");
  }, [user.first_name, user.last_name, user.phone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setIsSubmitting(true);

    const result = await updateProfile(user.id, {
      first_name: firstName,
      last_name: lastName,
      phone,
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
        Profil bearbeiten
      </h2>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" />
          Profil erfolgreich aktualisiert
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="firstName"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Vorname
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
              Nachname
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
            Telefon
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

        <div className="border-t border-gray-200 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Wird gespeichert..." : "Profil speichern"}
          </button>
        </div>
      </form>
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
          <p className="text-sm text-emerald-700">Gesamtspenden</p>
          <p className="text-2xl font-bold text-emerald-800">
            {formatCurrencyCents(totalPaid)}
          </p>
          <Link
            href="/member/spendenbescheinigung"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <FileText className="h-4 w-4" />
            Spendenbescheinigung
          </Link>
        </div>
      )}

      {/* Liste */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {donations.length === 0 ? (
          <div className="py-12 text-center">
            <Banknote className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">Noch keine Spenden</p>
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
                        Monatlich
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
                    ? "Bezahlt"
                    : d.status === "pending"
                      ? "Ausstehend"
                      : d.status === "failed"
                        ? "Fehlgeschlagen"
                        : d.status === "cancelled"
                          ? "Storniert"
                          : d.status === "refunded"
                            ? "Erstattet"
                            : "Erstellt"}
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
  const [events, setEvents] = useState<
    (EventRegistration & { event_title?: string; event_start_at?: string })[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

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
            Noch keine Event-Teilnahmen
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
                    Angemeldet
                  </>
                ) : reg.status === "attended" ? (
                  <>
                    <CheckCircle className="h-3 w-3" />
                    Teilgenommen
                  </>
                ) : reg.status === "cancelled" ? (
                  <>
                    <XCircle className="h-3 w-3" />
                    Abgemeldet
                  </>
                ) : (
                  "Nicht erschienen"
                )}
              </span>
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
}: {
  userId: string;
  mosqueId: string;
  stripeEnabled: boolean;
}) {
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [rows, setRows] = useState<FeeOverviewRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payingFeeId, setPayingFeeId] = useState<string | null>(null);
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

  return (
    <div className="space-y-4">
      {/* Monat-Navigation */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
        <button
          type="button"
          onClick={() => setMonthKey(prevMonthKey(monthKey))}
          className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50"
          aria-label="Vorheriger Monat"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-base font-semibold text-gray-900">{formatMonthKey(monthKey)}</span>
        <button
          type="button"
          onClick={() => setMonthKey(nextMonthKey(monthKey))}
          className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50"
          aria-label="Nächster Monat"
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
            <p className="text-sm text-gray-500">Keine Kinder hinterlegt</p>
            <p className="mt-1 text-xs text-gray-400">
              Wende dich an den Administrator, um deine Kinder im System zu verknüpfen.
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
                      {row.fee.payment_method === "cash" && " · Bar bezahlt"}
                      {row.fee.payment_method === "transfer" && " · Überweisung"}
                      {row.fee.payment_method === "stripe" && " · Online bezahlt"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!row.fee ? (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                      Kein Eintrag
                    </span>
                  ) : row.fee.status === "paid" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      <CheckCircle className="h-3 w-3" />
                      Bezahlt
                    </span>
                  ) : row.fee.status === "waived" ? (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                      Erlassen
                    </span>
                  ) : (
                    <>
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        Offen
                      </span>
                      {stripeEnabled && row.fee && (
                        <button
                          type="button"
                          onClick={() => handleOnlinePay(row.fee!.id)}
                          disabled={payingFeeId === row.fee!.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {payingFeeId === row.fee!.id ? "Weiterleiten..." : "Online bezahlen"}
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
    </div>
  );
}
