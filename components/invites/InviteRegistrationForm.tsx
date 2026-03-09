"use client";

import { useState } from "react";
import Link from "next/link";
import {
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  AlertCircle,
  Users,
  GraduationCap,
  Shield,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TurnstileWidget } from "@/components/shared/TurnstileWidget";

const ROLE_LABELS: Record<string, string> = {
  member: "Mitglied",
  teacher: "Lehrer/in",
  admin: "Administrator",
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  member: Users,
  teacher: GraduationCap,
  admin: Shield,
};

interface Props {
  mosqueName: string;
  mosqueSlug: string;
  token: string;
  inviteType: "personal" | "group";
  inviteLabel: string | null;
  defaultEmail: string | null;
  inviteRole: string;
}

export function InviteRegistrationForm({
  mosqueName,
  mosqueSlug,
  token,
  inviteType,
  inviteLabel,
  defaultEmail,
  inviteRole,
}: Props) {
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: defaultEmail || "",
    password: "",
    passwordConfirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const siteKeyConfigured = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!privacyAccepted) {
      setError("Bitte akzeptiere die Datenschutzerklärung.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`/api/${mosqueSlug}/invite/${token}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          password: formData.password,
          passwordConfirm: formData.passwordConfirm,
          accept_privacy: true,
          turnstile_token: turnstileToken || "",
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Registrierung fehlgeschlagen.");
        return;
      }

      // Account erstellt — einloggen, dann Erfolgsmeldung anzeigen
      await login(formData.email, formData.password);
      setSuccess(true);
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.");
    } finally {
      setIsLoading(false);
    }
  }

  const RoleIcon = ROLE_ICONS[inviteRole] || Users;

  if (success) {
    return (
      <section className="flex min-h-[80vh] items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl">Willkommen!</CardTitle>
            <CardDescription>
              Dein Konto wurde erfolgreich erstellt. Du bist jetzt Mitglied der Gemeinde{" "}
              <span className="font-medium text-gray-800">{mosqueName}</span>.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3">
            <a
              href={`/${mosqueSlug}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow transition-colors hover:bg-emerald-700"
            >
              Zum Gemeinde-Portal
              <ArrowRight className="h-4 w-4" />
            </a>
          </CardFooter>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex min-h-[80vh] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <UserPlus className="h-7 w-7 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl">Einladung annehmen</CardTitle>
          <CardDescription>
            Du wurdest eingeladen, der Gemeinde{" "}
            <span className="font-medium text-gray-800">{mosqueName}</span> beizutreten.
          </CardDescription>

          {/* Einladungs-Info */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <RoleIcon className="h-3 w-3" />
              {ROLE_LABELS[inviteRole] || inviteRole}
            </Badge>
            {inviteType === "group" && inviteLabel && (
              <Badge variant="outline" className="gap-1 text-xs">
                {inviteLabel}
              </Badge>
            )}
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Name */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">Vorname</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="first_name"
                    type="text"
                    placeholder="Vorname"
                    value={formData.first_name}
                    onChange={(e) => updateField("first_name", e.target.value)}
                    className="pl-10"
                    required
                    autoComplete="given-name"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Nachname</Label>
                <Input
                  id="last_name"
                  type="text"
                  placeholder="Nachname"
                  value={formData.last_name}
                  onChange={(e) => updateField("last_name", e.target.value)}
                  required
                  autoComplete="family-name"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* E-Mail */}
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="deine@email.de"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="email"
                  disabled={isLoading || !!defaultEmail}
                />
              </div>
              {defaultEmail && (
                <p className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  E-Mail durch Einladung vorausgefüllt
                </p>
              )}
            </div>

            {/* Passwort */}
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mindestens 8 Zeichen"
                  value={formData.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  className="pl-10 pr-10"
                  required
                  autoComplete="new-password"
                  minLength={8}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Passwort bestätigen */}
            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">Passwort bestätigen</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="passwordConfirm"
                  type={showPassword ? "text" : "password"}
                  placeholder="Passwort wiederholen"
                  value={formData.passwordConfirm}
                  onChange={(e) => updateField("passwordConfirm", e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="new-password"
                  minLength={8}
                  disabled={isLoading}
                />
              </div>
              {formData.passwordConfirm && formData.password !== formData.passwordConfirm && (
                <p className="text-xs text-red-500">Die Passwörter stimmen nicht überein.</p>
              )}
            </div>

            {/* Datenschutz Checkbox */}
            <div className="flex items-start gap-2">
              <input
                id="privacy"
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                required
                disabled={isLoading}
              />
              <label htmlFor="privacy" className="text-sm text-gray-600">
                Ich akzeptiere die{" "}
                <Link
                  href="/datenschutz"
                  className="text-emerald-600 hover:text-emerald-700"
                  target="_blank"
                >
                  Datenschutzerklärung
                </Link>
                .
              </label>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <TurnstileWidget onVerify={(token) => setTurnstileToken(token)} />
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading || (siteKeyConfigured && !turnstileToken)}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent motion-reduce:animate-none" />
                  Registrierung läuft…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Konto erstellen & beitreten
                </span>
              )}
            </Button>

            <p className="text-center text-sm text-gray-600">
              Bereits registriert?{" "}
              <Link href="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
                Jetzt anmelden
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}
