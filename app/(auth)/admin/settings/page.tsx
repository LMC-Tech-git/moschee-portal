"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Settings, Palette, Clock, Sliders, Save, RotateCcw, Upload, X, Check, ChevronDown, ChevronUp, GraduationCap, Mail, CheckCircle, AlertCircle, Send, Handshake, Users, MessageSquare, ExternalLink } from "lucide-react";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import {
  getPortalSettings,
  updateBrandingSettings,
  updatePrayerSettings,
  updateDefaultSettings,
  getMadrasaFeeSettings,
  updateMadrasaFeeSettings,
  getPbSmtpSettings,
  updatePbSmtpSettings,
  updateSponsorsSettings,
  updateTeamSettings,
  updateContactSettings,
  getResendStatus,
} from "@/lib/actions/settings";
import type { PbSmtpSettings } from "@/lib/actions/settings";
import { sendTestEmailAction } from "@/lib/actions/email";
import { THEME_PRESETS, PRAYER_METHODS, PRAYER_PROVIDERS } from "@/lib/constants";
import type { TuneOffsets } from "@/lib/prayer";
import { DEFAULT_TUNE } from "@/lib/prayer";
import type { Mosque, Settings as SettingsType } from "@/types";
import { useTranslations } from "next-intl";

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || "";

const TABS = [
  { id: "branding", icon: Palette },
  { id: "prayer", icon: Clock },
  { id: "defaults", icon: Sliders },
  { id: "madrasa", icon: GraduationCap },
  { id: "sponsors", icon: Handshake },
  { id: "team", icon: Users },
  { id: "contact", icon: MessageSquare },
  { id: "email", icon: Mail },
] as const;

type TabId = (typeof TABS)[number]["id"];

// =========================================
// Sub-components
// =========================================

function StatusMessage({
  status,
}: {
  status: { type: "success" | "error"; message: string } | null;
}) {
  if (!status) return null;
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ${
        status.type === "success"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-700"
      }`}
    >
      {status.type === "success" ? (
        <Check className="h-4 w-4" />
      ) : (
        <X className="h-4 w-4" />
      )}
      {status.message}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// =========================================
// Main Page
// =========================================

export default function AdminSettingsPage() {
  const { mosqueId, setTeamEnabled: setTeamEnabledCtx, setSponsorsEnabled: setSponsorsEnabledCtx } = useMosque();
  const { user } = useAuth();
  const t = useTranslations("settings");
  const [activeTab, setActiveTab] = useState<TabId>("branding");
  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sponsorsEnabled, setSponsorsEnabled] = useState(false);
  const [sponsorsVisibility, setSponsorsVisibility] = useState<"public" | "members">("public");
  const [teamEnabled, setTeamEnabled] = useState(false);
  const [teamVisibility, setTeamVisibility] = useState<"public" | "members">("public");
  const [contactEnabled, setContactEnabled] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactNotifyAdmin, setContactNotifyAdmin] = useState(true);
  const [contactAutoReply, setContactAutoReply] = useState(true);

  const [madrasaFeeSettings, setMadrasaFeeSettings] = useState<{
    madrasa_fees_enabled: boolean;
    madrasa_default_fee_cents: number;
    fee_reminder_enabled: boolean;
    fee_reminder_day: number;
  }>({ madrasa_fees_enabled: false, madrasa_default_fee_cents: 1000, fee_reminder_enabled: false, fee_reminder_day: 15 });

  useEffect(() => {
    if (!mosqueId) return;
    async function load() {
      const [portalResult, feeResult] = await Promise.all([
        getPortalSettings(mosqueId),
        getMadrasaFeeSettings(mosqueId),
      ]);
      if (portalResult.success && portalResult.mosque && portalResult.settings) {
        setMosque(portalResult.mosque);
        setSettings(portalResult.settings);
        setSponsorsEnabled(portalResult.settings.sponsors_enabled ?? false);
        setSponsorsVisibility(portalResult.settings.sponsors_visibility ?? "public");
        setTeamEnabled(portalResult.settings.team_enabled ?? false);
        setTeamVisibility(portalResult.settings.team_visibility ?? "public");
        setContactEnabled(portalResult.settings.contact_enabled ?? false);
        setContactEmail(portalResult.settings.contact_email ?? "");
        setContactNotifyAdmin(portalResult.settings.contact_notify_admin ?? true);
        setContactAutoReply(portalResult.settings.contact_auto_reply ?? true);
      }
      if (feeResult.success && feeResult.data) {
        setMadrasaFeeSettings(feeResult.data);
      }
      setIsLoading(false);
    }
    load();
  }, [mosqueId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (!mosque || !settings) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        {t("loadError")}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
          <Settings className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">{mosque.name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-1">
        {TABS.filter(({ id }) => id !== "email" || user?.role === "super_admin").map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="h-4 w-4" />
            {t(`tab.${id}` as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "branding" && (
        <BrandingTab
          mosque={mosque}
          mosqueId={mosqueId}
          userId={user?.id || ""}
          onSaved={(updated) => setMosque({ ...mosque, ...updated })}
        />
      )}
      {activeTab === "prayer" && (
        <PrayerTab
          settings={settings}
          mosque={mosque}
          mosqueId={mosqueId}
          userId={user?.id || ""}
          onSaved={(updates) => {
            setSettings({
              ...settings,
              prayer_method: updates.prayer_method,
              prayer_provider: updates.prayer_provider as "aladhan" | "off",
              tune: updates.tune,
            });
            if (updates.lat !== null && updates.lon !== null) {
              setMosque({ ...mosque, latitude: updates.lat, longitude: updates.lon });
            }
          }}
        />
      )}
      {activeTab === "defaults" && (
        <DefaultsTab
          settings={settings}
          mosqueId={mosqueId}
          userId={user?.id || ""}
          onSaved={(updated) => setSettings({ ...settings, ...updated })}
        />
      )}
      {activeTab === "madrasa" && (
        <MadrasaTab
          mosqueId={mosqueId}
          userId={user?.id || ""}
          feeSettings={madrasaFeeSettings}
          donationProvider={mosque.donation_provider}
          onSaved={(updated) => setMadrasaFeeSettings({ ...madrasaFeeSettings, ...updated })}
        />
      )}
      {activeTab === "sponsors" && (
        <SponsorsTab
          mosqueId={mosqueId}
          userId={user?.id || ""}
          sponsorsEnabled={sponsorsEnabled}
          sponsorsVisibility={sponsorsVisibility}
          onSaved={(enabled, visibility) => { setSponsorsEnabled(enabled); setSponsorsVisibility(visibility); setSponsorsEnabledCtx(enabled); }}
        />
      )}
      {activeTab === "team" && (
        <TeamTab
          mosqueId={mosqueId}
          userId={user?.id || ""}
          teamEnabled={teamEnabled}
          teamVisibility={teamVisibility}
          onSaved={(enabled, visibility) => {
            setTeamEnabled(enabled);
            setTeamVisibility(visibility);
            setTeamEnabledCtx(enabled);
          }}
        />
      )}
      {activeTab === "contact" && (
        <ContactTab
          mosqueId={mosqueId}
          userId={user?.id || ""}
          mosqueEmail={mosque.email}
          mosqueSlug={mosque.slug}
          contactEnabled={contactEnabled}
          contactEmail={contactEmail}
          contactNotifyAdmin={contactNotifyAdmin}
          contactAutoReply={contactAutoReply}
          onSaved={(enabled, email, notifyAdmin, autoReply) => {
            setContactEnabled(enabled);
            setContactEmail(email);
            setContactNotifyAdmin(notifyAdmin);
            setContactAutoReply(autoReply);
          }}
        />
      )}
      {activeTab === "email" && user?.role === "super_admin" && (
        <EmailTab
          mosqueId={mosqueId}
          adminEmail={user?.email || ""}
        />
      )}
    </div>
  );
}

// =========================================
// Tab: Branding
// =========================================

function BrandingTab({
  mosque,
  mosqueId,
  userId,
  onSaved,
}: {
  mosque: Mosque;
  mosqueId: string;
  userId: string;
  onSaved: (updated: Partial<Mosque>) => void;
}) {
  const t = useTranslations("settings");
  const { refreshMosque } = useMosque();
  const router = useRouter();
  const [form, setForm] = useState({
    name: mosque.name || "",
    address: mosque.address || "",
    zip_code: mosque.zip_code || "",
    city: mosque.city || "",
    phone: mosque.phone || "",
    email: mosque.email || "",
    website: mosque.website || "",
    brand_theme: mosque.brand_theme || "emerald",
    brand_primary_color: mosque.brand_primary_color || "#059669",
    brand_accent_color: mosque.brand_accent_color || "#d97706",
    brand_hero_type: mosque.brand_hero_type || "color",
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(
    mosque.brand_logo ? `${PB_URL}/api/files/mosques/${mosque.id}/${mosque.brand_logo}` : null
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(
    mosque.brand_hero_image ? `${PB_URL}/api/files/mosques/${mosque.id}/${mosque.brand_hero_image}` : null
  );
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [removeHeroImage, setRemoveHeroImage] = useState(false);
  const heroImageInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [hexError, setHexError] = useState<{ primary?: string; accent?: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCustomTheme = form.brand_theme === "custom";

  function validateHex(val: string) {
    return /^#[0-9A-Fa-f]{6}$/.test(val);
  }

  function handleThemeSelect(themeId: string) {
    const preset = THEME_PRESETS.find((p) => p.id === themeId);
    setForm((prev) => ({
      ...prev,
      brand_theme: themeId,
      brand_primary_color: preset?.primary || prev.brand_primary_color,
      brand_accent_color: preset?.accent || prev.brand_accent_color,
    }));
    setHexError({});
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
      setStatus({ type: "error", message: t("branding.logoHint") });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setStatus({ type: "error", message: t("branding.logoHint") });
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
    setStatus(null);
  }

  function handleRemoveLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleHeroImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setStatus({ type: "error", message: t("branding.heroImageHint") });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatus({ type: "error", message: t("branding.heroImageHint") });
      return;
    }
    setHeroImageFile(file);
    setHeroImagePreview(URL.createObjectURL(file));
    setRemoveHeroImage(false);
    setStatus(null);
  }

  function handleRemoveHeroImage() {
    setHeroImageFile(null);
    setHeroImagePreview(null);
    setRemoveHeroImage(true);
    if (heroImageInputRef.current) heroImageInputRef.current.value = "";
  }

  async function handleSave() {
    const errors: { primary?: string; accent?: string } = {};
    if (isCustomTheme && !validateHex(form.brand_primary_color)) {
      errors.primary = t("branding.invalidColor");
    }
    if (isCustomTheme && !validateHex(form.brand_accent_color)) {
      errors.accent = t("branding.invalidColor");
    }
    if (errors.primary || errors.accent) {
      setHexError(errors);
      return;
    }
    setHexError({});
    setIsSaving(true);
    setStatus(null);

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (logoFile) fd.append("brand_logo", logoFile);
    if (removeLogo) fd.append("remove_logo", "1");
    if (heroImageFile) fd.append("brand_hero_image", heroImageFile);
    if (removeHeroImage) fd.append("remove_hero_image", "1");

    const result = await updateBrandingSettings(mosqueId, userId, fd);
    setIsSaving(false);
    if (result.success) {
      setStatus({ type: "success", message: t("branding.saved") });
      setLogoFile(null);
      setRemoveLogo(false);
      setHeroImageFile(null);
      setRemoveHeroImage(false);
      onSaved({ ...form, ...(removeLogo ? { brand_logo: "" } : {}), ...(removeHeroImage ? { brand_hero_image: "" } : {}) });
      if (typeof refreshMosque === "function") {
        refreshMosque();
      } else {
        router.refresh();
      }
    } else {
      setStatus({ type: "error", message: result.error || t("branding.saveError") });
    }
  }

  function handleReset() {
    setForm({
      name: mosque.name || "",
      address: mosque.address || "",
      zip_code: mosque.zip_code || "",
      city: mosque.city || "",
      phone: mosque.phone || "",
      email: mosque.email || "",
      website: mosque.website || "",
      brand_theme: mosque.brand_theme || "emerald",
      brand_primary_color: mosque.brand_primary_color || "#059669",
      brand_accent_color: mosque.brand_accent_color || "#d97706",
      brand_hero_type: mosque.brand_hero_type || "color",
    });
    setLogoFile(null);
    setRemoveLogo(false);
    setLogoPreview(mosque.brand_logo ? `${PB_URL}/api/files/mosques/${mosque.id}/${mosque.brand_logo}` : null);
    setHeroImageFile(null);
    setRemoveHeroImage(false);
    setHeroImagePreview(mosque.brand_hero_image ? `${PB_URL}/api/files/mosques/${mosque.id}/${mosque.brand_hero_image}` : null);
    setHexError({});
    setStatus(null);
  }

  return (
    <div className="space-y-6">
      {/* Gemeinde-Informationen */}
      <SectionCard title={t("branding.communityInfo")} description={t("branding.communityInfoDesc")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t("branding.communityName")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="DITIB Ulm e.V."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("branding.street")}</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Musterstraße 1"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("branding.zipCode")}</label>
            <input
              type="text"
              value={form.zip_code}
              onChange={(e) => setForm((p) => ({ ...p, zip_code: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="89073"
              maxLength={10}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("branding.city")}</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Ulm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("branding.phone")}</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="+49 731 123456"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("branding.email")}</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="info@moschee.de"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("branding.website")}</label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="https://www.moschee.de"
            />
          </div>
        </div>
      </SectionCard>

      {/* Logo */}
      <SectionCard title={t("branding.logo")} description={t("branding.logoDesc")}>
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-1" />
            ) : (
              <span className="text-2xl font-bold text-gray-300">
                {form.name.charAt(0).toUpperCase() || "M"}
              </span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" />
                {t("branding.uploadLogo")}
              </button>
              {logoPreview && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                >
                  <X className="h-4 w-4" />
                  {t("branding.removeLogo")}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {t("branding.logoHint")}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleLogoChange}
            />
          </div>
        </div>
      </SectionCard>

      {/* Hero-Hintergrund */}
      <SectionCard title={t("branding.heroBackground")} description={t("branding.heroBackgroundDesc")}>
        <div className="space-y-4">
          {/* Radio: Farbe / Bild */}
          <div className="flex flex-wrap gap-3">
            <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all ${form.brand_hero_type === "color" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-700 hover:border-gray-300"}`}>
              <input
                type="radio"
                name="brand_hero_type"
                value="color"
                checked={form.brand_hero_type === "color"}
                onChange={() => setForm((p) => ({ ...p, brand_hero_type: "color" }))}
                className="hidden"
              />
              <span className="h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: form.brand_hero_type === "color" ? "#059669" : "#d1d5db" }}>
                {form.brand_hero_type === "color" && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
              </span>
              {t("branding.heroTypeColor")}
            </label>
            <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all ${form.brand_hero_type === "image" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-700 hover:border-gray-300"}`}>
              <input
                type="radio"
                name="brand_hero_type"
                value="image"
                checked={form.brand_hero_type === "image"}
                onChange={() => setForm((p) => ({ ...p, brand_hero_type: "image" }))}
                className="hidden"
              />
              <span className="h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: form.brand_hero_type === "image" ? "#059669" : "#d1d5db" }}>
                {form.brand_hero_type === "image" && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
              </span>
              {t("branding.heroTypeImage")}
            </label>
          </div>

          {/* Farbe-Modus: Info */}
          {form.brand_hero_type === "color" && (
            <p className="text-sm text-gray-500">{t("branding.heroColorInfo")}</p>
          )}

          {/* Bild-Modus: Upload */}
          {form.brand_hero_type === "image" && (
            <div className="space-y-3">
              {/* Vorschau */}
              <div className="relative h-28 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                {heroImagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={heroImagePreview} alt="Hero" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-400">
                    {t("branding.heroNoImage")}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => heroImageInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Upload className="h-4 w-4" />
                  {t("branding.uploadHeroImage")}
                </button>
                {heroImagePreview && (
                  <button
                    type="button"
                    onClick={handleRemoveHeroImage}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                  >
                    <X className="h-4 w-4" />
                    {t("branding.removeHeroImage")}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400">{t("branding.heroImageHint")}</p>
              <input
                ref={heroImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleHeroImageChange}
              />
            </div>
          )}
        </div>
      </SectionCard>

      {/* Theme */}
      <SectionCard title={t("branding.colorScheme")} description={t("branding.colorSchemeDesc")}>
        {/* Preset Grid */}
        <div className="mb-5 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleThemeSelect(preset.id)}
              className={`group relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition-all ${
                form.brand_theme === preset.id
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {preset.id === "custom" ? (
                <div className="flex h-8 w-14 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-lg">
                  ✏️
                </div>
              ) : (
                <div className="flex gap-1">
                  <div
                    className="h-8 w-6 rounded-l-md"
                    style={{ background: preset.primary }}
                  />
                  <div
                    className="h-8 w-6 rounded-r-md"
                    style={{ background: preset.accent }}
                  />
                </div>
              )}
              <span className="text-xs font-medium leading-tight text-gray-700">
                {preset.name}
              </span>
              {form.brand_theme === preset.id && (
                <div className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                  <Check className="h-2.5 w-2.5 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Custom Colors */}
        {isCustomTheme && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t("branding.primaryColor")} <span className="text-gray-400 font-normal">(#RRGGBB)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.brand_primary_color}
                  onChange={(e) => setForm((p) => ({ ...p, brand_primary_color: e.target.value }))}
                  className="h-9 w-12 cursor-pointer rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={form.brand_primary_color}
                  onChange={(e) => setForm((p) => ({ ...p, brand_primary_color: e.target.value }))}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 ${
                    hexError.primary
                      ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                      : "border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                  }`}
                  placeholder="#059669"
                  maxLength={7}
                />
              </div>
              {hexError.primary && (
                <p className="mt-1 text-xs text-red-600">{hexError.primary}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t("branding.accentColor")} <span className="text-gray-400 font-normal">(#RRGGBB)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.brand_accent_color}
                  onChange={(e) => setForm((p) => ({ ...p, brand_accent_color: e.target.value }))}
                  className="h-9 w-12 cursor-pointer rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={form.brand_accent_color}
                  onChange={(e) => setForm((p) => ({ ...p, brand_accent_color: e.target.value }))}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 ${
                    hexError.accent
                      ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                      : "border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                  }`}
                  placeholder="#d97706"
                  maxLength={7}
                />
              </div>
              {hexError.accent && (
                <p className="mt-1 text-xs text-red-600">{hexError.accent}</p>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <StatusMessage status={status} />
        <div className="ml-auto flex gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw className="h-4 w-4" />
            {t("reset")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? t("save") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================
// Tab: Gebetszeiten
// =========================================

const TUNE_LABELS: { key: keyof TuneOffsets; label: string }[] = [
  { key: "fajr",    label: "Fajr"    },
  { key: "sunrise", label: "Shuruk"  },
  { key: "dhuhr",   label: "Dhuhr"   },
  { key: "asr",     label: "Asr"     },
  { key: "maghrib", label: "Maghrib" },
  { key: "isha",    label: "Isha"    },
];

function parseTune(raw: string): TuneOffsets {
  try {
    return raw ? { ...DEFAULT_TUNE, ...(JSON.parse(raw) as Partial<TuneOffsets>) } : { ...DEFAULT_TUNE };
  } catch {
    return { ...DEFAULT_TUNE };
  }
}

function PrayerTab({
  settings,
  mosque,
  mosqueId,
  userId,
  onSaved,
}: {
  settings: SettingsType;
  mosque: Mosque;
  mosqueId: string;
  userId: string;
  onSaved: (updates: {
    prayer_method: number;
    prayer_provider: string;
    tune: string;
    lat: number | null;
    lon: number | null;
  }) => void;
}) {
  const t = useTranslations("settings");
  const [prayerProvider, setPrayerProvider] = useState<"aladhan" | "off">(
    (settings.prayer_provider as "aladhan" | "off") || "aladhan"
  );
  const [prayerMethod, setPrayerMethod] = useState(settings.prayer_method || 13);
  const [latitude, setLatitude] = useState(
    mosque.latitude ? String(mosque.latitude) : ""
  );
  const [longitude, setLongitude] = useState(
    mosque.longitude ? String(mosque.longitude) : ""
  );
  const [tune, setTune] = useState<TuneOffsets>(() => parseTune(settings.tune || ""));
  const [showTune, setShowTune] = useState(false);
  const [coordError, setCoordError] = useState<{ lat?: string; lon?: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function parseCoord(val: string): number | null {
    const n = parseFloat(val.trim());
    return isNaN(n) ? null : n;
  }

  async function handleSave() {
    const errors: { lat?: string; lon?: string } = {};
    const lat = latitude.trim() ? parseCoord(latitude) : null;
    const lon = longitude.trim() ? parseCoord(longitude) : null;

    if (prayerProvider === "aladhan") {
      if (latitude.trim() && lat === null) {
        errors.lat = "Ungültige Zahl (z.B. 48.4010)";
      } else if (lat !== null && (lat < -90 || lat > 90)) {
        errors.lat = "Breitengrad muss zwischen -90 und 90 liegen.";
      }
      if (longitude.trim() && lon === null) {
        errors.lon = "Ungültige Zahl (z.B. 9.9876)";
      } else if (lon !== null && (lon < -180 || lon > 180)) {
        errors.lon = "Längengrad muss zwischen -180 und 180 liegen.";
      }
    }

    if (errors.lat || errors.lon) {
      setCoordError(errors);
      return;
    }
    setCoordError({});
    setIsSaving(true);
    setStatus(null);

    const tuneJson = JSON.stringify(tune);
    const result = await updatePrayerSettings(mosqueId, userId, {
      prayer_method: prayerMethod,
      prayer_provider: prayerProvider,
      tune: tuneJson,
      latitude: lat,
      longitude: lon,
    });

    setIsSaving(false);
    if (result.success) {
      setStatus({ type: "success", message: t("prayer.saved") });
      onSaved({ prayer_method: prayerMethod, prayer_provider: prayerProvider, tune: tuneJson, lat, lon });
    } else {
      setStatus({ type: "error", message: result.error || t("prayer.saved") });
    }
  }

  return (
    <div className="space-y-6">
      {/* Provider-Auswahl */}
      <SectionCard
        title={t("prayer.provider")}
        description={t("prayer.providerDesc")}
      >
        <div className="flex flex-wrap gap-3">
          {PRAYER_PROVIDERS.map(({ value, label }) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-5 py-3 transition-colors ${
                prayerProvider === value
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="prayer_provider"
                value={value}
                checked={prayerProvider === value}
                onChange={() => setPrayerProvider(value as "aladhan" | "off")}
                className="h-4 w-4 accent-emerald-600"
              />
              <span className="text-sm font-medium text-gray-800">{label}</span>
            </label>
          ))}
        </div>
      </SectionCard>

      {prayerProvider === "aladhan" && (
        <>
          {/* Koordinaten */}
          <SectionCard
            title={t("prayer.coordinates")}
            description={t("prayer.coordinatesDesc")}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  {t("prayer.latitude")}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={latitude}
                  onChange={(e) => {
                    setLatitude(e.target.value);
                    setCoordError((p) => ({ ...p, lat: undefined }));
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 ${
                    coordError.lat
                      ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                      : "border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                  }`}
                  placeholder="48.4010"
                />
                {coordError.lat && (
                  <p className="mt-1 text-xs text-red-600">{coordError.lat}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  {t("prayer.longitude")}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={longitude}
                  onChange={(e) => {
                    setLongitude(e.target.value);
                    setCoordError((p) => ({ ...p, lon: undefined }));
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 ${
                    coordError.lon
                      ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                      : "border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                  }`}
                  placeholder="9.9876"
                />
                {coordError.lon && (
                  <p className="mt-1 text-xs text-red-600">{coordError.lon}</p>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Tipp: Koordinaten auf{" "}
              <span className="font-medium text-gray-500">maps.google.com</span>{" "}
              → Rechtsklick auf den Standort.
            </p>
          </SectionCard>

          {/* Berechnungsmethode */}
          <SectionCard
            title={t("prayer.method")}
            description={t("prayer.methodDesc")}
          >
            <div className="space-y-2">
              {PRAYER_METHODS.map(({ method, name }) => (
                <label
                  key={method}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${
                    prayerMethod === method
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="prayer_method"
                    value={method}
                    checked={prayerMethod === method}
                    onChange={() => setPrayerMethod(method)}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  <span className="text-sm font-medium text-gray-800">{name}</span>
                  {method === 3 && (
                    <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Europa
                    </span>
                  )}
                  {method === 13 && (
                    <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Diyanet
                    </span>
                  )}
                </label>
              ))}
            </div>
          </SectionCard>

          {/* Feinabstimmung (Tune) */}
          <SectionCard
            title={t("prayer.tuning")}
            description={t("prayer.tuningDesc")}
          >
            <button
              type="button"
              onClick={() => setShowTune((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              {showTune ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {showTune ? t("prayer.tuningHide") : t("prayer.tuningShow")}
            </button>

            {showTune && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {TUNE_LABELS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      {label}
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={tune[key]}
                        min={-60}
                        max={60}
                        onChange={(e) =>
                          setTune((prev) => ({
                            ...prev,
                            [key]: parseInt(e.target.value) || 0,

                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-mono text-center focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <span className="text-xs text-gray-400">{t("prayer.tuningMin")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!showTune && Object.values(tune).some((v) => v !== 0) && (
              <p className="mt-2 text-xs text-amber-600">
                Aktive Offsets: {TUNE_LABELS.filter(({ key }) => tune[key] !== 0)
                  .map(({ key, label }) => `${label} ${tune[key] > 0 ? "+" : ""}${tune[key]}`)
                  .join(", ")}
              </p>
            )}
          </SectionCard>
        </>
      )}

      {prayerProvider === "off" && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
          {t("prayer.providerDisabled")}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <StatusMessage status={status} />
        <div className="ml-auto">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? t("save") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================
// Tab: Defaults
// =========================================

function DefaultsTab({
  settings,
  mosqueId,
  userId,
  onSaved,
}: {
  settings: SettingsType;
  mosqueId: string;
  userId: string;
  onSaved: (updated: Partial<SettingsType>) => void;
}) {
  const t = useTranslations("settings");
  const [form, setForm] = useState({
    locale: settings.locale || "de",
    default_post_visibility: settings.default_post_visibility || "public",
    default_event_visibility: settings.default_event_visibility || "public",
    donation_quick_amounts: settings.donation_quick_amounts || "10,25,50,100",
  });
  const [amountsError, setAmountsError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function validateAmounts(val: string) {
    const parts = val.split(",").map((s) => s.trim());
    const valid = parts.every((p) => /^\d+(\.\d{1,2})?$/.test(p) && parseFloat(p) > 0);
    return valid;
  }

  async function handleSave() {
    if (!validateAmounts(form.donation_quick_amounts)) {
      setAmountsError(t("defaults.donationAmountsPlaceholder"));
      return;
    }
    setAmountsError("");
    setIsSaving(true);
    setStatus(null);
    const result = await updateDefaultSettings(mosqueId, userId, form);
    setIsSaving(false);
    if (result.success) {
      setStatus({ type: "success", message: t("defaults.saved") });
      onSaved(form);
    } else {
      setStatus({ type: "error", message: result.error || t("defaults.saveError") });
    }
  }

  function handleReset() {
    setForm({
      locale: settings.locale || "de",
      default_post_visibility: settings.default_post_visibility || "public",
      default_event_visibility: settings.default_event_visibility || "public",
      donation_quick_amounts: settings.donation_quick_amounts || "10,25,50,100",
    });
    setAmountsError("");
    setStatus(null);
  }

  const quickAmounts = form.donation_quick_amounts
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Sprache */}
      <SectionCard title={t("language.title")} description={t("language.desc")}>
        <div className="flex gap-3">
          {[
            { value: "de", label: t("language.de") },
            { value: "tr", label: t("language.tr") },
          ].map(({ value, label }) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-5 py-3 transition-colors ${
                form.locale === value
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="locale"
                value={value}
                checked={form.locale === value}
                onChange={() => setForm((p) => ({ ...p, locale: value }))}
                className="h-4 w-4 accent-emerald-600"
              />
              <span className="text-sm font-medium text-gray-800">{label}</span>
            </label>
          ))}
        </div>
      </SectionCard>

      {/* Standard-Sichtbarkeit */}
      <SectionCard
        title={t("defaults.visibilityTitle")}
        description={t("defaults.visibilityDesc")}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">{t("defaults.postsLabel")}</label>
            <div className="flex gap-3">
              {[
                { value: "public", label: t("defaults.public") },
                { value: "members", label: t("defaults.members") },
              ].map(({ value, label }) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2.5 transition-colors ${
                    form.default_post_visibility === value
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="post_visibility"
                    value={value}
                    checked={form.default_post_visibility === value}
                    onChange={() => setForm((p) => ({ ...p, default_post_visibility: value }))}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  <span className="text-sm font-medium text-gray-800">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">{t("defaults.eventsLabel")}</label>
            <div className="flex gap-3">
              {[
                { value: "public", label: t("defaults.public") },
                { value: "members", label: t("defaults.members") },
              ].map(({ value, label }) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2.5 transition-colors ${
                    form.default_event_visibility === value
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="event_visibility"
                    value={value}
                    checked={form.default_event_visibility === value}
                    onChange={() => setForm((p) => ({ ...p, default_event_visibility: value }))}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  <span className="text-sm font-medium text-gray-800">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Spenden Schnellbeträge */}
      <SectionCard
        title={t("defaults.donationAmounts")}
        description={t("defaults.donationAmountsDesc")}
      >
        <div>
          <input
            type="text"
            value={form.donation_quick_amounts}
            onChange={(e) => {
              setForm((p) => ({ ...p, donation_quick_amounts: e.target.value }));
              setAmountsError("");
            }}
            className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 ${
              amountsError
                ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                : "border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
            }`}
            placeholder="10,25,50,100"
          />
          {amountsError && (
            <p className="mt-1 text-xs text-red-600">{amountsError}</p>
          )}
          {/* Vorschau */}
          {quickAmounts.length > 0 && !amountsError && (
            <div className="mt-3 flex flex-wrap gap-2">
              {quickAmounts.map((amt, i) => (
                <span
                  key={i}
                  className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700"
                >
                  {amt} €
                </span>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <StatusMessage status={status} />
        <div className="ml-auto flex gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw className="h-4 w-4" />
            {t("reset")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? t("save") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================
// Tab: Madrasa
// =========================================

function MadrasaTab({
  mosqueId,
  userId,
  feeSettings,
  donationProvider,
  onSaved,
}: {
  mosqueId: string;
  userId: string;
  feeSettings: { madrasa_fees_enabled: boolean; madrasa_default_fee_cents: number; fee_reminder_enabled: boolean; fee_reminder_day: number };
  donationProvider: string;
  onSaved: (updated: { madrasa_fees_enabled: boolean; madrasa_default_fee_cents: number; fee_reminder_enabled: boolean; fee_reminder_day: number }) => void;
}) {
  const t = useTranslations("settings");
  const [feesEnabled, setFeesEnabled] = useState(feeSettings.madrasa_fees_enabled);
  const [defaultFeeCents, setDefaultFeeCents] = useState(feeSettings.madrasa_default_fee_cents);
  const [reminderEnabled, setReminderEnabled] = useState(feeSettings.fee_reminder_enabled);
  const [reminderDay, setReminderDay] = useState(feeSettings.fee_reminder_day);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const defaultFeeEur = (defaultFeeCents / 100).toFixed(2);
  const stripeEnabled = donationProvider === "stripe";

  async function handleSave() {
    setIsSaving(true);
    setStatus(null);
    const result = await updateMadrasaFeeSettings(mosqueId, userId, {
      madrasa_fees_enabled: feesEnabled,
      madrasa_default_fee_cents: defaultFeeCents,
      fee_reminder_enabled: reminderEnabled,
      fee_reminder_day: reminderDay,
    });
    setIsSaving(false);
    if (result.success) {
      setStatus({ type: "success", message: t("madrasaFee.saved") });
      onSaved({
        madrasa_fees_enabled: feesEnabled,
        madrasa_default_fee_cents: defaultFeeCents,
        fee_reminder_enabled: reminderEnabled,
        fee_reminder_day: reminderDay,
      });
    } else {
      setStatus({ type: "error", message: result.error || t("madrasaFee.saveError") });
    }
  }

  function handleReset() {
    setFeesEnabled(feeSettings.madrasa_fees_enabled);
    setDefaultFeeCents(feeSettings.madrasa_default_fee_cents);
    setReminderEnabled(feeSettings.fee_reminder_enabled);
    setReminderDay(feeSettings.fee_reminder_day);
    setStatus(null);
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title={t("madrasaFee.title")}
        description={t("madrasaFee.desc")}
      >
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 hover:bg-gray-50">
          <div>
            <p className="font-medium text-gray-900">{t("madrasaFee.enabled")}</p>
            <p className="mt-0.5 text-sm text-gray-500">
              {t("madrasaFee.enabledDesc")}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={feesEnabled}
            onClick={() => setFeesEnabled((p) => !p)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
              feesEnabled ? "bg-emerald-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                feesEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </label>
      </SectionCard>

      {feesEnabled && (
        <>
          <SectionCard
            title={t("madrasaFee.defaultAmount")}
            description={t("madrasaFee.defaultAmountDesc")}
          >
            <div className="flex items-center gap-3">
              <div className="relative w-40">
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  value={defaultFeeEur}
                  onChange={(e) => {
                    const eur = parseFloat(e.target.value) || 0;
                    setDefaultFeeCents(Math.round(eur * 100));
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-8 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">€</span>
              </div>
              <span className="text-sm text-gray-500">{defaultFeeCents} {t("madrasaFee.cents")}</span>
            </div>
          </SectionCard>

          <SectionCard
            title={t("madrasaFee.onlineTitle")}
            description={t("madrasaFee.onlineDesc")}
          >
            {stripeEnabled ? (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div className="text-sm text-emerald-800">
                  <p className="font-medium">{t("madrasaFee.stripeActive")}</p>
                  <p className="mt-0.5 text-emerald-700">
                    {t("madrasaFee.onlineDesc")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <X className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">{t("madrasaFee.noStripe")}</p>
                  <p className="mt-0.5 text-amber-700">
                    {t("madrasaFee.noStripe")}
                  </p>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={t("madrasaFee.reminderTitle")}
            description={t("madrasaFee.reminderDesc")}
          >
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 hover:bg-gray-50">
              <div>
                <p className="font-medium text-gray-900">{t("madrasaFee.reminderEnabled")}</p>
                <p className="mt-0.5 text-sm text-gray-500">
                  {t("madrasaFee.reminderEnabledDesc")}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={reminderEnabled}
                onClick={() => setReminderEnabled((p) => !p)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                  reminderEnabled ? "bg-emerald-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                    reminderEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </label>

            {reminderEnabled && (
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-gray-700">{t("madrasaFee.reminderDay")}</label>
                <p className="text-xs text-gray-500">{t("madrasaFee.reminderDayDesc")}</p>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={reminderDay}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 15;
                    setReminderDay(Math.max(1, Math.min(28, v)));
                  }}
                  className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-xs text-gray-400">{t("madrasaFee.reminderDayHint")}</p>
              </div>
            )}
          </SectionCard>
        </>
      )}

      <div className="flex items-center justify-between gap-4">
        <StatusMessage status={status} />
        <div className="ml-auto flex gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw className="h-4 w-4" />
            {t("reset")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? t("save") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================
// E-Mail Tab
// =========================================

const DEFAULT_SMTP: PbSmtpSettings = {
  smtp: {
    enabled: true,
    host: "smtp.resend.com",
    port: 465,
    username: "resend",
    password: "",
    tls: true,
    authMethod: "PLAIN",
    localName: "",
  },
  meta: {
    senderName: "Moschee Portal",
    senderAddress: "",
    appName: "Moschee Portal",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "",
  },
};

function EmailTab({ mosqueId: _mosqueId, adminEmail }: { mosqueId: string; adminEmail: string }) {
  const t = useTranslations("settings");
  const [smtpData, setSmtpData] = useState<PbSmtpSettings>(DEFAULT_SMTP);
  const [isLoadingSmtp, setIsLoadingSmtp] = useState(true);
  const [resendConfigured, setResendConfigured] = useState<boolean | null>(null);
  const [testEmail, setTestEmail] = useState(adminEmail);
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [testStatus, setTestStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    getPbSmtpSettings().then((r) => {
      if (r.success && r.data) setSmtpData(r.data);
      setIsLoadingSmtp(false);
    });
    getResendStatus().then((r) => setResendConfigured(r.configured));
  }, []);

  async function handleTestEmail() {
    if (!testEmail.trim()) return;
    setIsTesting(true);
    setTestStatus(null);
    const r = await sendTestEmailAction(testEmail.trim());
    setTestStatus(
      r.success
        ? { type: "success", message: t("email.resendTestSuccess") }
        : { type: "error", message: r.error || t("email.saveError") }
    );
    setIsTesting(false);
  }

  async function handleSaveSmtp() {
    setIsSavingSmtp(true);
    setSmtpStatus(null);
    const r = await updatePbSmtpSettings(smtpData);
    setSmtpStatus(
      r.success
        ? { type: "success", message: t("email.saved") }
        : { type: "error", message: r.error || t("email.saveError") }
    );
    setIsSavingSmtp(false);
  }

  function updateSmtp(field: keyof PbSmtpSettings["smtp"], value: string | number | boolean) {
    setSmtpData((prev) => ({ ...prev, smtp: { ...prev.smtp, [field]: value } }));
  }

  function updateMeta(field: keyof PbSmtpSettings["meta"], value: string) {
    setSmtpData((prev) => ({ ...prev, meta: { ...prev.meta, [field]: value } }));
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="space-y-6">
      {/* Resend API Status */}
      <SectionCard
        title={t("email.resendTitle")}
        description={t("email.resendDesc")}
      >
        <div className="space-y-4">
          {/* Status-Badge */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">{t("email.resendStatusLabel")}:</span>
            {resendConfigured === null ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 inline-block" />
            ) : resendConfigured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                <CheckCircle className="h-3.5 w-3.5" />
                {t("email.resendConfigured")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
                <AlertCircle className="h-3.5 w-3.5" />
                {t("email.resendNotConfigured")}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-500">{t("email.resendManagedBy")}</p>

          {/* Test-E-Mail */}
          <div className="space-y-2">
            <label className={labelCls}>{t("email.resendTestLabel")}</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder={t("email.resendTestPlaceholder")}
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={isTesting || !testEmail.trim() || !resendConfigured}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {isTesting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isTesting ? t("email.resendSending") : t("email.resendSend")}
              </button>
            </div>
            {testStatus && (
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  testStatus.type === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {testStatus.type === "success" ? (
                  <CheckCircle className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                {testStatus.message}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* PocketBase SMTP */}
      <SectionCard
        title={t("email.smtpTitle")}
        description={t("email.smtpDesc")}
      >
        {isLoadingSmtp ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Resend SMTP Tipp */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-medium mb-1">Resend als SMTP-Relay einrichten</p>
              <p className="text-amber-700">
                Host: <code className="rounded bg-amber-100 px-1">smtp.resend.com</code> &bull;
                Port: <code className="rounded bg-amber-100 px-1">465</code> &bull;
                Benutzername: <code className="rounded bg-amber-100 px-1">resend</code> &bull;
                Passwort: dein Resend API-Key
              </p>
              <p className="mt-2 text-amber-700 font-medium">Wichtig – Action-URL in PocketBase Admin:</p>
              <code className="block mt-1 rounded bg-amber-100 px-2 py-1 text-xs font-mono break-all">
                {(process.env.NEXT_PUBLIC_APP_URL || "https://deine-domain.de") + "/passwort-zuruecksetzen?token={TOKEN}"}
              </code>
            </div>

            {/* SMTP Felder */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>{t("email.host")}</label>
                <input
                  type="text"
                  value={smtpData.smtp.host}
                  onChange={(e) => updateSmtp("host", e.target.value)}
                  placeholder="smtp.resend.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t("email.port")}</label>
                <input
                  type="number"
                  value={smtpData.smtp.port}
                  onChange={(e) => updateSmtp("port", parseInt(e.target.value) || 465)}
                  placeholder="465"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t("email.username")}</label>
                <input
                  type="text"
                  value={smtpData.smtp.username}
                  onChange={(e) => updateSmtp("username", e.target.value)}
                  placeholder="resend"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t("email.password")}</label>
                <input
                  type="password"
                  value={smtpData.smtp.password}
                  onChange={(e) => updateSmtp("password", e.target.value)}
                  placeholder="re_xxxxxxxx"
                  className={inputCls}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>{t("email.senderName")}</label>
                <input
                  type="text"
                  value={smtpData.meta.senderName}
                  onChange={(e) => updateMeta("senderName", e.target.value)}
                  placeholder="Moschee Portal"
                  className={inputCls}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>{t("email.senderAddress")}</label>
                <input
                  type="email"
                  value={smtpData.meta.senderAddress}
                  onChange={(e) => updateMeta("senderAddress", e.target.value)}
                  placeholder="noreply@deine-domain.de"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="smtp-tls"
                type="checkbox"
                checked={smtpData.smtp.tls}
                onChange={(e) => updateSmtp("tls", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="smtp-tls" className="text-sm text-gray-700">
                {t("email.tls")}
              </label>
            </div>

            <div className="flex items-center justify-between gap-4 pt-2">
              <StatusMessage status={smtpStatus} />
              <button
                type="button"
                onClick={handleSaveSmtp}
                disabled={isSavingSmtp}
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSavingSmtp ? t("email.saving") : t("email.save")}
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// =========================================
// Tab: Förderpartner
// =========================================

function SponsorsTab({
  mosqueId,
  userId,
  sponsorsEnabled,
  sponsorsVisibility,
  onSaved,
}: {
  mosqueId: string;
  userId: string;
  sponsorsEnabled: boolean;
  sponsorsVisibility: "public" | "members";
  onSaved: (enabled: boolean, visibility: "public" | "members") => void;
}) {
  const t = useTranslations("settings");
  const [enabled, setEnabled] = useState(sponsorsEnabled);
  const [visibility, setVisibility] = useState<"public" | "members">(sponsorsVisibility);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setStatus(null);
    const result = await updateSponsorsSettings(mosqueId, userId, { sponsors_enabled: enabled, sponsors_visibility: visibility });
    if (result.success) {
      onSaved(enabled, visibility);
      setStatus({ type: "success", message: t("sponsors.saved") });
    } else {
      setStatus({ type: "error", message: result.error || t("saveError") });
    }
    setIsSaving(false);
  }

  return (
    <div className="space-y-6">
      <StatusMessage status={status} />
      <SectionCard title={t("sponsors.title")} description={t("sponsors.desc")}>
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                className="sr-only"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <div
                className={`h-5 w-10 rounded-full transition-colors ${enabled ? "bg-emerald-600" : "bg-gray-200"}`}
              >
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{t("sponsors.enabledLabel")}</p>
              <p className="text-xs text-gray-500">{t("sponsors.enabledHint")}</p>
            </div>
          </label>

          {/* Sichtbarkeit */}
          {enabled && (
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-700">{t("sponsors.visibilityLabel")}</p>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="sponsors_visibility"
                    value="public"
                    checked={visibility === "public"}
                    onChange={() => setVisibility("public")}
                    className="h-4 w-4 text-emerald-600"
                  />
                  <span className="text-sm text-gray-700">{t("sponsors.visibilityPublic")}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="sponsors_visibility"
                    value="members"
                    checked={visibility === "members"}
                    onChange={() => setVisibility("members")}
                    className="h-4 w-4 text-emerald-600"
                  />
                  <span className="text-sm text-gray-700">{t("sponsors.visibilityMembers")}</span>
                </label>
              </div>
            </div>
          )}

          {enabled && (
            <a
              href="/admin/foerderpartner"
              className="flex items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <Handshake className="h-4 w-4" />
              {t("sponsors.manageLink")}
            </a>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? t("sponsors.saving") : t("sponsors.save")}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

// =========================================
// Tab: Leitung & Team
// =========================================

function TeamTab({
  mosqueId,
  userId,
  teamEnabled,
  teamVisibility,
  onSaved,
}: {
  mosqueId: string;
  userId: string;
  teamEnabled: boolean;
  teamVisibility: "public" | "members";
  onSaved: (enabled: boolean, visibility: "public" | "members") => void;
}) {
  const t = useTranslations("settings");
  const [enabled, setEnabled] = useState(teamEnabled);
  const [visibility, setVisibility] = useState<"public" | "members">(teamVisibility);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setStatus(null);
    const result = await updateTeamSettings(mosqueId, userId, {
      team_enabled: enabled,
      team_visibility: visibility,
    });
    if (result.success) {
      onSaved(enabled, visibility);
      setStatus({ type: "success", message: t("team.saved") });
    } else {
      setStatus({ type: "error", message: result.error || t("saveError") });
    }
    setIsSaving(false);
  }

  return (
    <div className="space-y-6">
      <StatusMessage status={status} />
      <SectionCard title={t("team.title")} description={t("team.desc")}>
        <div className="space-y-4">
          {/* Toggle */}
          <label className="flex cursor-pointer items-start gap-3">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                className="sr-only"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <div
                className={`h-5 w-10 rounded-full transition-colors ${enabled ? "bg-emerald-600" : "bg-gray-200"}`}
              >
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{t("team.enabledLabel")}</p>
              <p className="text-xs text-gray-500">{t("team.enabledHint")}</p>
            </div>
          </label>

          {/* Sichtbarkeit */}
          {enabled && (
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-700">{t("team.visibilityLabel")}</p>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="team_visibility"
                    value="public"
                    checked={visibility === "public"}
                    onChange={() => setVisibility("public")}
                    className="h-4 w-4 text-emerald-600"
                  />
                  <span className="text-sm text-gray-700">{t("team.visibilityPublic")}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="team_visibility"
                    value="members"
                    checked={visibility === "members"}
                    onChange={() => setVisibility("members")}
                    className="h-4 w-4 text-emerald-600"
                  />
                  <span className="text-sm text-gray-700">{t("team.visibilityMembers")}</span>
                </label>
              </div>
            </div>
          )}

          {enabled && (
            <a
              href="/admin/leitung"
              className="flex items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <Users className="h-4 w-4" />
              {t("team.manageLink")}
            </a>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? t("team.saving") : t("team.save")}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

// =========================================
// Tab: Kontaktformular
// =========================================

function ContactTab({
  mosqueId,
  userId,
  mosqueEmail,
  mosqueSlug,
  contactEnabled,
  contactEmail,
  contactNotifyAdmin,
  contactAutoReply,
  onSaved,
}: {
  mosqueId: string;
  userId: string;
  mosqueEmail: string;
  mosqueSlug: string;
  contactEnabled: boolean;
  contactEmail: string;
  contactNotifyAdmin: boolean;
  contactAutoReply: boolean;
  onSaved: (enabled: boolean, email: string, notifyAdmin: boolean, autoReply: boolean) => void;
}) {
  const t = useTranslations("settings");
  const [enabled, setEnabled] = useState(contactEnabled);
  const [email, setEmail] = useState(contactEmail);
  const [notifyAdmin, setNotifyAdmin] = useState(contactNotifyAdmin);
  const [autoReply, setAutoReply] = useState(contactAutoReply);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Prüft ob eine Ziel-E-Mail vorhanden ist (eigene oder Moschee-E-Mail)
  const hasTargetEmail = email.trim().length > 0 || mosqueEmail.trim().length > 0;

  async function handleSave() {
    // Client-seitige Validierung: Aktivieren ohne E-Mail nicht erlaubt
    if (enabled && !hasTargetEmail) {
      setStatus({ type: "error", message: t("contact.enabledRequiresEmail") });
      return;
    }
    setIsSaving(true);
    setStatus(null);
    const result = await updateContactSettings(mosqueId, userId, {
      contact_enabled: enabled,
      contact_email: email.trim(),
      contact_notify_admin: notifyAdmin,
      contact_auto_reply: autoReply,
    });
    if (result.success) {
      onSaved(enabled, email.trim(), notifyAdmin, autoReply);
      setStatus({ type: "success", message: t("contact.saved") });
    } else {
      setStatus({ type: "error", message: result.error || t("contact.saveError") });
    }
    setIsSaving(false);
  }

  return (
    <div className="space-y-6">
      <StatusMessage status={status} />
      <SectionCard title={t("contact.title")} description={t("contact.desc")}>
        <div className="space-y-5">
          {/* E-Mail-Eingabe */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t("contact.emailLabel")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={mosqueEmail || t("contact.emailPlaceholder")}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <p className="mt-1 text-xs text-gray-500">{t("contact.emailHint")}</p>
          </div>

          {/* Aktivierungs-Toggle */}
          <label className="flex cursor-pointer items-start gap-3">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                className="sr-only"
                checked={enabled}
                disabled={!hasTargetEmail}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <div
                className={`h-5 w-10 rounded-full transition-colors ${enabled && hasTargetEmail ? "bg-emerald-600" : "bg-gray-200"}`}
              >
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled && hasTargetEmail ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{t("contact.enabledLabel")}</p>
              <p className="text-xs text-gray-500">
                {!hasTargetEmail
                  ? t("contact.enabledRequiresEmail")
                  : t("contact.enabledHint")}
              </p>
            </div>
          </label>

          {/* Weitere Optionen nur wenn aktiviert */}
          {enabled && hasTargetEmail && (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              {/* Admin-Benachrichtigung */}
              <label className="flex cursor-pointer items-start gap-3">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={notifyAdmin}
                    onChange={(e) => setNotifyAdmin(e.target.checked)}
                  />
                  <div className={`h-5 w-10 rounded-full transition-colors ${notifyAdmin ? "bg-emerald-600" : "bg-gray-200"}`}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${notifyAdmin ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{t("contact.notifyAdminLabel")}</p>
                  <p className="text-xs text-gray-500">{t("contact.notifyAdminHint")}</p>
                </div>
              </label>

              {/* Auto-Reply */}
              <label className="flex cursor-pointer items-start gap-3">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={autoReply}
                    onChange={(e) => setAutoReply(e.target.checked)}
                  />
                  <div className={`h-5 w-10 rounded-full transition-colors ${autoReply ? "bg-emerald-600" : "bg-gray-200"}`}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${autoReply ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{t("contact.autoReplyLabel")}</p>
                  <p className="text-xs text-gray-500">{t("contact.autoReplyHint")}</p>
                </div>
              </label>
            </div>
          )}

          {/* Link zur öffentlichen Kontaktseite */}
          {enabled && hasTargetEmail && (
            <a
              href={`/${mosqueSlug}/kontakt`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              {t("contact.manageLink")}
            </a>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? t("contact.saving") : t("contact.save")}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
