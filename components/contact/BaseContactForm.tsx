"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import type { ContactFormConfig, InquiryType } from "@/lib/contact/inquiryTypes";

interface BaseContactFormProps<T extends InquiryType> {
  config: ContactFormConfig<T>;
  mosqueName?: string;
}

export function BaseContactForm<T extends InquiryType>({
  config,
  mosqueName,
}: BaseContactFormProps<T>) {
  if (process.env.NODE_ENV !== "production" && !config.apiPath.startsWith("/api/")) {
    throw new Error(
      `ContactForm: apiPath must start with "/api/", got: "${config.apiPath}"`
    );
  }

  const t = useTranslations("contact");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organization: "",
    inquiry_type: (config.defaultInquiryType ?? "") as string,
    message: "",
    privacy_accepted: false,
    website: "", // honeypot — niemals sichtbar für echte Nutzer
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setError(t("errors.nameTooShort"));
      return;
    }
    if (!formData.email.trim()) {
      setError(t("errors.emailRequired"));
      return;
    }
    if (!formData.inquiry_type) {
      setError(t("errors.inquiryTypeRequired"));
      return;
    }
    if (!formData.message.trim() || formData.message.trim().length < 10) {
      setError(t("errors.messageTooShort"));
      return;
    }
    if (!formData.privacy_accepted) {
      setError(t("errors.privacyRequired"));
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(config.apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || t("errors.generic"));
        return;
      }

      setSuccess(true);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  }

  // ── Erfolgs-Ansicht ──────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-600" aria-hidden="true" />
        <h2 className="mb-2 text-xl font-bold text-emerald-900">{t("success.title")}</h2>
        <p className="text-emerald-700">
          {mosqueName
            ? t("success.messageNamed", { name: mosqueName })
            : t("success.message")}
        </p>
      </div>
    );
  }

  // ── Formular ─────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate aria-label={t("formLabel")}>
      {/* Honeypot — versteckt für echte Nutzer, Bots füllen es aus */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="website">Website (nicht ausfüllen)</label>
        <input
          id="website"
          name="website"
          type="text"
          value={formData.website}
          onChange={handleChange}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="space-y-5">
        {/* Name */}
        <div>
          <label
            htmlFor="contact-name"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {t("fields.name")}{" "}
            <span aria-hidden="true" className="text-red-500">
              *
            </span>
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            disabled={isLoading}
            value={formData.name}
            onChange={handleChange}
            placeholder={t("placeholders.name")}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        {/* E-Mail */}
        <div>
          <label
            htmlFor="contact-email"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {t("fields.email")}{" "}
            <span aria-hidden="true" className="text-red-500">
              *
            </span>
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            disabled={isLoading}
            value={formData.email}
            onChange={handleChange}
            placeholder={t("placeholders.email")}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        {/* Organisation — nur bei Plattform-Form */}
        {config.showOrganization && (
          <div>
            <label
              htmlFor="contact-organization"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              {t("fields.organization")}
              <span className="ml-1 text-xs font-normal text-gray-400">
                ({t("optional")})
              </span>
            </label>
            <input
              id="contact-organization"
              name="organization"
              type="text"
              autoComplete="organization"
              disabled={isLoading}
              value={formData.organization}
              onChange={handleChange}
              placeholder={t("placeholders.organization")}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
        )}

        {/* Anfragetyp */}
        <div>
          <label
            htmlFor="contact-inquiry-type"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {t("fields.inquiryType")}{" "}
            <span aria-hidden="true" className="text-red-500">
              *
            </span>
          </label>
          <select
            id="contact-inquiry-type"
            name="inquiry_type"
            required
            disabled={isLoading}
            value={formData.inquiry_type}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="">{t("placeholders.inquiryType")}</option>
            {config.inquiryTypes.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Nachricht */}
        <div>
          <label
            htmlFor="contact-message"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {t("fields.message")}{" "}
            <span aria-hidden="true" className="text-red-500">
              *
            </span>
          </label>
          <textarea
            id="contact-message"
            name="message"
            required
            rows={5}
            disabled={isLoading}
            value={formData.message}
            onChange={handleChange}
            placeholder={t("placeholders.message")}
            className="w-full resize-y rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-gray-50 disabled:text-gray-500"
          />
          <p className="mt-1 text-right text-xs text-gray-400">
            {formData.message.length}/2000
          </p>
        </div>

        {/* DSGVO-Checkbox */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="privacy_accepted"
              id="contact-privacy"
              required
              disabled={isLoading}
              checked={formData.privacy_accepted}
              onChange={handleChange}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm leading-relaxed text-gray-600">
              {t("privacy.text")}{" "}
              <Link
                href="/datenschutz"
                target="_blank"
                className="font-medium text-emerald-600 underline hover:text-emerald-700"
              >
                {t("privacy.link")}
              </Link>
              .{" "}
              <span aria-hidden="true" className="text-red-500">
                *
              </span>
            </span>
          </label>
        </div>

        {/* Fehlermeldung */}
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-base font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("submitting")}
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              {t("submit")}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
