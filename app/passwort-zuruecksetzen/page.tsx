"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { KeyRound, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { getClientPB } from "@/lib/pocketbase";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const t = useTranslations("resetPassword");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <section className="flex min-h-[80vh] items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-7 w-7 text-red-600" />
            </div>
            <CardTitle className="text-2xl">{t("invalidTitle")}</CardTitle>
            <CardDescription>{t("invalidDesc")}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link href="/passwort-vergessen" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              {t("requestNew")}
            </Link>
          </CardFooter>
        </Card>
      </section>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setError(t("mismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("mismatch"));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const pb = getClientPB();
      await pb.collection("users").confirmPasswordReset(token, password, passwordConfirm);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: unknown) {
      const pbErr = err as { message?: string };
      if (pbErr?.message?.includes("invalid")) {
        setError(t("errorInvalid"));
      } else {
        setError(t("errorGeneric"));
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <section className="flex min-h-[80vh] items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-7 w-7 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl">{t("successTitle")}</CardTitle>
            <CardDescription>{t("successDesc")}</CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex min-h-[80vh] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-100">
            <KeyRound className="h-7 w-7 text-primary-600" />
          </div>
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">{t("passwordLabel")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  required
                  minLength={8}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">{t("confirmLabel")}</Label>
              <Input
                id="passwordConfirm"
                type={showPassword ? "text" : "password"}
                placeholder={t("confirmPlaceholder")}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                minLength={8}
                disabled={isLoading}
              />
            </div>

            {password && passwordConfirm && password !== passwordConfirm && (
              <p className="text-xs text-red-600">{t("mismatch")}</p>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading || !password || !passwordConfirm || password !== passwordConfirm}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t("submitting")}
                </span>
              ) : (
                t("submit")
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}
