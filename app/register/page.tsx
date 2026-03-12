"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Hash,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useMosque } from "@/lib/mosque-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { mosqueId, isLoading: mosqueLoading } = useMosque();

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    member_no: "",
    email: "",
    password: "",
    passwordConfirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [agbAccepted, setAgbAccepted] = useState(false);

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.passwordConfirm) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    if (formData.password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }

    if (!agbAccepted) {
      setError("Bitte akzeptieren Sie die AGB und Datenschutzerklärung.");
      return;
    }

    if (!mosqueId) {
      setError("Keine Gemeinde gefunden. Bitte laden Sie die Seite neu.");
      return;
    }

    setIsLoading(true);

    try {
      await register({
        email: formData.email,
        password: formData.password,
        passwordConfirm: formData.passwordConfirm,
        first_name: formData.first_name,
        last_name: formData.last_name,
        member_no: formData.member_no || undefined,
        mosque_id: mosqueId || "",
      });
      toast.success("Registrierung erfolgreich! Willkommen im Moschee-Portal.");
      router.push("/member/profile");
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "";
      if (msg === "EMAIL_EXISTS") {
        setError("Diese E-Mail-Adresse ist bereits registriert.");
      } else if (msg === "PASSWORD_MISMATCH") {
        setError("Die Passwörter stimmen nicht überein.");
      } else if (msg.startsWith("PASSWORD_INVALID:")) {
        setError("Passwort: " + msg.replace("PASSWORD_INVALID: ", ""));
      } else {
        setError(msg || "Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="flex min-h-[80vh] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <UserPlus className="h-7 w-7 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl">Konto erstellen</CardTitle>
          <CardDescription>
            Registrieren Sie sich als Gemeindemitglied
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
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

            {/* Mitgliedsnummer (optional) */}
            <div className="space-y-2">
              <Label htmlFor="member_no">Mitgliedsnummer (optional)</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="member_no"
                  type="text"
                  placeholder="z.B. M-001"
                  value={formData.member_no}
                  onChange={(e) => updateField("member_no", e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-gray-500">
                Falls vorhanden, erhalten Sie diese von der Moschee-Verwaltung.
              </p>
            </div>

            {/* E-Mail */}
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="ihre@email.de"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
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
              {formData.passwordConfirm &&
                formData.password !== formData.passwordConfirm && (
                  <p className="text-xs text-red-500">
                    Die Passwörter stimmen nicht überein.
                  </p>
                )}
            </div>

            {/* AGB Checkbox */}
            <div className="flex items-start gap-2">
              <input
                id="agb"
                type="checkbox"
                checked={agbAccepted}
                onChange={(e) => setAgbAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                required
                disabled={isLoading}
              />
              <label htmlFor="agb" className="text-sm text-gray-600">
                Ich akzeptiere die{" "}
                <Link href="/agb" className="text-emerald-600 hover:text-emerald-700" target="_blank">
                  AGB
                </Link>{" "}
                und{" "}
                <Link href="/datenschutz" className="text-emerald-600 hover:text-emerald-700" target="_blank">
                  Datenschutzerklärung
                </Link>.
              </label>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            {!mosqueLoading && !mosqueId && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 w-full">
                <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                Registrierung ist nur über einen Einladungslink möglich.
              </div>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={isLoading || mosqueLoading || !mosqueId}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent motion-reduce:animate-none" />
                  Registrierung…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Registrieren
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
