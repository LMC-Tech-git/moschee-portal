"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations();
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
      setError(t("register.error.passwordMismatch"));
      return;
    }

    if (formData.password.length < 8) {
      setError(t("register.error.passwordTooShort"));
      return;
    }

    if (!agbAccepted) {
      setError(t("register.error.agbRequired"));
      return;
    }

    if (!mosqueId) {
      setError(t("register.error.noMosque"));
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
      toast.success(t("register.success"));
      router.push("/member/profile");
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "";
      if (msg === "EMAIL_EXISTS") {
        setError(t("register.error.emailExists"));
      } else if (msg === "PASSWORD_MISMATCH") {
        setError(t("register.error.passwordMismatch"));
      } else if (msg.startsWith("PASSWORD_INVALID:")) {
        setError("Passwort: " + msg.replace("PASSWORD_INVALID: ", ""));
      } else {
        setError(msg || t("register.error.generic"));
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
          <CardTitle className="text-2xl">{t("register.title")}</CardTitle>
          <CardDescription>
            {t("register.subtitle")}
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
                <Label htmlFor="first_name">{t("register.firstNameLabel")}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="first_name"
                    type="text"
                    placeholder={t("register.firstNamePlaceholder")}
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
                <Label htmlFor="last_name">{t("register.lastNameLabel")}</Label>
                <Input
                  id="last_name"
                  type="text"
                  placeholder={t("register.lastNamePlaceholder")}
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
              <Label htmlFor="member_no">{t("register.memberNoLabel")}</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="member_no"
                  type="text"
                  placeholder={t("register.memberNoPlaceholder")}
                  value={formData.member_no}
                  onChange={(e) => updateField("member_no", e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-gray-500">
                {t("register.memberNoHint")}
              </p>
            </div>

            {/* E-Mail */}
            <div className="space-y-2">
              <Label htmlFor="email">{t("register.emailLabel")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t("register.emailPlaceholder")}
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
              <Label htmlFor="password">{t("register.passwordLabel")}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("register.passwordPlaceholder")}
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
                  aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Passwort bestätigen */}
            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">{t("register.passwordConfirmLabel")}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="passwordConfirm"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("register.passwordConfirmPlaceholder")}
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
                    {t("register.passwordMismatch")}
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
                  {t("register.agbLink")}
                </Link>{" "}
                und{" "}
                <Link href="/datenschutz" className="text-emerald-600 hover:text-emerald-700" target="_blank">
                  {t("register.privacyLink")}
                </Link>.
              </label>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            {!mosqueLoading && !mosqueId && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 w-full">
                <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                {t("register.inviteOnly")}
              </div>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={isLoading || mosqueLoading || !mosqueId}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent motion-reduce:animate-none" />
                  {t("register.submitting")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  {t("register.submit")}
                </span>
              )}
            </Button>

            <p className="text-center text-sm text-gray-600">
              {t("register.alreadyRegistered")}{" "}
              <Link href="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
                {t("register.loginNow")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}
