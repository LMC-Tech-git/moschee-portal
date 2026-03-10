"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  User,
  Mail,
  Phone,
  Hash,
  Shield,
  AlertCircle,
  CreditCard,
  CalendarDays,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useMosque } from "@/lib/mosque-context";
import {
  getMemberById,
  updateMember,
  getMemberDonations,
  getMemberEventHistory,
} from "@/lib/actions/members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ROLE_OPTIONS } from "@/lib/constants";
import type { User as UserType, Donation, EventRegistration } from "@/types";

export default function MitgliedBearbeitenPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { mosqueId } = useMosque();
  const memberId = params.id as string;

  const [member, setMember] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Formular-State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [membershipNumber, setMembershipNumber] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");

  // Historie
  const [donations, setDonations] = useState<Donation[]>([]);
  const [events, setEvents] = useState<(EventRegistration & { event_title?: string; event_start_at?: string })[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    if (!memberId || !mosqueId) return;

    async function loadMember() {
      try {
        const result = await getMemberById(memberId, mosqueId);
        if (!result.success || !result.data) {
          setError(result.error || "Mitglied konnte nicht geladen werden.");
          setIsLoading(false);
          return;
        }

        const m = result.data;
        setMember(m);
        setFullName(m.full_name || "");
        setEmail(m.email || "");
        setPhone(m.phone || "");
        setMembershipNumber(m.membership_number || m.member_no || "");
        setRole(m.role || "member");
        setStatus(m.status || "pending");
      } catch (err) {
        console.error("Mitglied laden Fehler:", err);
        setError("Mitglied konnte nicht geladen werden.");
      } finally {
        setIsLoading(false);
      }
    }

    loadMember();
  }, [memberId, mosqueId]);

  // Historie laden (parallel, nach Member)
  useEffect(() => {
    if (!memberId || !mosqueId || !member) return;

    async function loadHistory() {
      setHistoryLoading(true);
      const [donRes, evtRes] = await Promise.all([
        getMemberDonations(memberId, mosqueId),
        getMemberEventHistory(memberId, mosqueId),
      ]);
      if (donRes.success && donRes.data) setDonations(donRes.data);
      if (evtRes.success && evtRes.data) setEvents(evtRes.data);
      setHistoryLoading(false);
    }

    loadHistory();
  }, [memberId, mosqueId, member]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setError("");

    try {
      const result = await updateMember(memberId, mosqueId, user.id, {
        full_name: fullName,
        phone,
        membership_number: membershipNumber,
        role,
        status,
      });

      if (result.success) {
        toast.success("Mitglied erfolgreich aktualisiert");
        router.push("/admin/mitglieder");
      } else {
        setError(result.error || "Fehler beim Speichern");
        toast.error(result.error || "Fehler beim Speichern");
      }
    } catch (err) {
      setError("Fehler beim Speichern");
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error && !member) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/mitglieder">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Liste
          </Link>
        </Button>
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    active: "bg-emerald-100 text-emerald-700",
    inactive: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/mitglieder"
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          aria-label="Zurück zur Mitgliederliste"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Mitglied bearbeiten
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Registriert am {member ? formatDate(member.created) : ""}
          </p>
        </div>
        <Badge className={STATUS_COLORS[status] || "bg-gray-100 text-gray-600"}>
          {status === "pending" ? "Ausstehend" : status === "active" ? "Aktiv" : "Inaktiv"}
        </Badge>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Persönliche Daten */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-gray-500" />
                Persönliche Daten
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Vollständiger Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-Mail-Adresse</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    className="pl-10 bg-gray-50"
                    disabled
                  />
                </div>
                <p className="text-xs text-gray-400">
                  E-Mail kann nur vom Benutzer selbst geändert werden
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="membershipNumber">Mitgliedsnummer</Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="membershipNumber"
                    value={membershipNumber}
                    onChange={(e) => setMembershipNumber(e.target.value)}
                    className="pl-10"
                    placeholder="z.B. M-001"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rolle und Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-gray-500" />
                Rolle und Status
              </CardTitle>
              <CardDescription>
                Berechtigung und Aktivierungsstatus des Mitglieds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">Rolle</Label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="pending">Ausstehend</option>
                  <option value="active">Aktiv</option>
                  <option value="inactive">Inaktiv</option>
                </select>
              </div>

              {status === "pending" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  Dieses Mitglied wartet auf Freischaltung. Setzen Sie den
                  Status auf &quot;Aktiv&quot; um den Zugang zu gewähren.
                </div>
              )}

              <Separator />

              <div className="text-xs text-gray-400 space-y-1">
                <p>ID: <span className="font-mono">{member?.id}</span></p>
                <p>Erstellt: {member ? formatDate(member.created) : "—"}</p>
                <p>Aktualisiert: {member ? formatDate(member.updated) : "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Speichern */}
        <div className="mt-6 flex justify-end gap-3">
          <Button asChild variant="outline">
            <Link href="/admin/mitglieder">Abbrechen</Link>
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Speichern...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Änderungen speichern
              </span>
            )}
          </Button>
        </div>
      </form>

      {/* Historie */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Spendenhistorie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-gray-500" />
              Spendenhistorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : donations.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">
                Keine Spenden vorhanden.
              </p>
            ) : (
              <div className="divide-y">
                {donations.map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(d.amount_cents / 100)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(d.paid_at || d.created)}
                      </p>
                    </div>
                    <Badge
                      className={
                        d.status === "paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : d.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : d.status === "refunded"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                      }
                    >
                      {d.status === "paid"
                        ? "Bezahlt"
                        : d.status === "failed"
                        ? "Fehlgeschlagen"
                        : d.status === "refunded"
                        ? "Erstattet"
                        : d.status === "created"
                        ? "Offen"
                        : d.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event-Teilnahmen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-gray-500" />
              Event-Teilnahmen
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">
                Keine Event-Teilnahmen vorhanden.
              </p>
            ) : (
              <div className="divide-y">
                {events.map((evt) => (
                  <div key={evt.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {evt.event_title || "Unbekanntes Event"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {evt.event_start_at ? formatDate(evt.event_start_at) : formatDate(evt.created)}
                      </p>
                    </div>
                    <Badge
                      className={
                        evt.status === "registered"
                          ? "bg-emerald-100 text-emerald-700"
                          : evt.status === "cancelled"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                      }
                    >
                      {evt.status === "registered"
                        ? "Angemeldet"
                        : evt.status === "cancelled"
                        ? "Abgemeldet"
                        : evt.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
