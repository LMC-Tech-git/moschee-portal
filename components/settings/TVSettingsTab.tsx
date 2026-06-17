"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Tv,
  Save,
  ExternalLink,
  Copy,
  Check,
  X,
  GripVertical,
  AlertTriangle,
  Info,
} from "lucide-react";
import { getTVSettings, updateTVSettings } from "@/lib/actions/settings";
import type { TVModuleKey, TVLocaleMode } from "@/types";
import { TV_MODULE_KEYS } from "@/types";
import { getContrastRatio } from "@/lib/color-contrast";
import { useTranslations } from "next-intl";

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────

interface TVForm {
  tv_enabled: boolean;
  tv_modules: Record<TVModuleKey, boolean>;
  tv_slide_order: TVModuleKey[];
  tv_module_counts: Partial<Record<TVModuleKey, number>>;
  tv_rotation_seconds: number;
  tv_locale_mode: TVLocaleMode;
  tv_locale_primary: string;
  tv_locale_secondary: string;
  tv_locale_rotate_seconds: number;
  tv_bg_color: string;
  tv_text_color: string;
  tv_accent_color: string;
  tv_announcement_text: string;
  tv_announcement_text_secondary: string;
  tv_show_hijri: boolean;
  tv_show_arabic_prayer_names: boolean;
  tv_highlight_active_prayer: boolean;
  tv_highlight_duration_seconds: number;
}

const DEFAULT_FORM: TVForm = {
  tv_enabled: false,
  tv_modules: {
    prayer: true,
    events: true,
    posts: true,
    campaigns: false,
    qr_donate: false,
    qr_transfer: false,
    announcement: false,
  },
  tv_slide_order: ["prayer", "events", "posts", "announcement", "campaigns", "qr_donate", "qr_transfer"],
  tv_module_counts: { events: 3, posts: 1, campaigns: 1 },
  tv_rotation_seconds: 15,
  tv_locale_mode: "single",
  tv_locale_primary: "de",
  tv_locale_secondary: "tr",
  tv_locale_rotate_seconds: 8,
  tv_bg_color: "",
  tv_text_color: "",
  tv_accent_color: "",
  tv_announcement_text: "",
  tv_announcement_text_secondary: "",
  tv_show_hijri: true,
  tv_show_arabic_prayer_names: true,
  tv_highlight_active_prayer: true,
  tv_highlight_duration_seconds: 300,
};

// ───────────────────────────────────────────────────────────────────────────
// Module label map (inline — no i18n needed for TV module names in admin)
// ───────────────────────────────────────────────────────────────────────────

const MODULE_LABELS: Record<TVModuleKey, { de: string; icon: string }> = {
  prayer:       { de: "Gebetszeiten", icon: "🕌" },
  events:       { de: "Veranstaltungen", icon: "📅" },
  posts:        { de: "Beiträge", icon: "📝" },
  campaigns:    { de: "Spendenaktionen", icon: "🎯" },
  qr_donate:    { de: "Spendenlink (QR)", icon: "📲" },
  qr_transfer:  { de: "Überweisung (QR)", icon: "🏦" },
  announcement: { de: "Ankündigung", icon: "📢" },
};

const LOCALE_LABELS: Record<string, string> = {
  de: "Deutsch",
  tr: "Türkisch",
  ar: "Arabisch",
  en: "Englisch",
};

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function isValidHex(v: string) {
  return v === "" || /^#[0-9a-fA-F]{6}$/.test(v);
}

function contrastLabel(ratio: number) {
  if (ratio >= 7) return { label: `${ratio.toFixed(1)}:1 ✓ AAA`, color: "text-emerald-600" };
  if (ratio >= 4.5) return { label: `${ratio.toFixed(1)}:1 ✓ AA`, color: "text-emerald-600" };
  if (ratio >= 3) return { label: `${ratio.toFixed(1)}:1 ⚠ schwach`, color: "text-amber-600" };
  return { label: `${ratio.toFixed(1)}:1 ✗ unzureichend`, color: "text-red-600" };
}

// ───────────────────────────────────────────────────────────────────────────
// Sortable module row
// ───────────────────────────────────────────────────────────────────────────

function SortableModuleRow({
  moduleKey,
  enabled,
  count,
  onToggle,
  onCountChange,
}: {
  moduleKey: TVModuleKey;
  enabled: boolean;
  count: number | undefined;
  onToggle: () => void;
  onCountChange: (v: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: moduleKey,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const showCount = ["events", "posts", "campaigns"].includes(moduleKey);
  const meta = MODULE_LABELS[moduleKey];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5"
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-gray-300 hover:text-gray-500 active:cursor-grabbing"
        aria-label="Verschieben"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Icon + Label */}
      <span className="text-base">{meta.icon}</span>
      <span className="flex-1 text-sm font-medium text-gray-800">{meta.de}</span>

      {/* Count input */}
      {showCount && enabled && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">Anzahl</span>
          <input
            type="number"
            min={1}
            max={10}
            value={count ?? 3}
            onChange={(e) => onCountChange(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
            className="w-14 rounded-md border border-gray-200 px-2 py-1 text-center text-xs"
          />
        </div>
      )}

      {/* Toggle */}
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors ${
          enabled ? "bg-emerald-500" : "bg-gray-200"
        }`}
        aria-pressed={enabled}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Color input with live contrast preview
// ───────────────────────────────────────────────────────────────────────────

function ColorField({
  label,
  value,
  onChange,
  placeholder,
  contrastWith,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  contrastWith?: string;
}) {
  const valid = isValidHex(value);
  const ratio =
    contrastWith && isValidHex(value) && isValidHex(contrastWith) && value && contrastWith
      ? getContrastRatio(value, contrastWith)
      : null;
  const cl = ratio !== null ? contrastLabel(ratio) : null;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        {value && valid && (
          <span
            className="h-8 w-8 flex-shrink-0 rounded-md border border-gray-200"
            style={{ backgroundColor: value }}
          />
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "#1a1a1a"}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-mono ${
            !valid ? "border-red-300 bg-red-50" : "border-gray-300"
          }`}
          maxLength={7}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-gray-400 hover:text-gray-600"
            title="Zurücksetzen (Brand-Farbe)"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {cl && (
        <p className={`text-xs ${cl.color}`}>
          Kontrast: {cl.label}
        </p>
      )}
      {!valid && value && (
        <p className="text-xs text-red-600">Ungültiges HEX-Format (z.B. #1a2b3c)</p>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────────────────────────────────

export default function TVSettingsTab({
  mosqueId,
  userId,
  mosqueSlug,
}: {
  mosqueId: string;
  userId: string;
  mosqueSlug: string;
}) {
  const t = useTranslations("settings");
  const [form, setForm] = useState<TVForm>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const tvUrl = `https://${mosqueSlug}.moschee.app/tv`;

  // Load
  useEffect(() => {
    if (!mosqueId) return;
    getTVSettings(mosqueId).then((res) => {
      if (res) {
        setForm({
          tv_enabled: res.tv_enabled,
          tv_modules: res.tv_modules,
          tv_slide_order: res.tv_slide_order,
          tv_module_counts: res.tv_module_counts,
          tv_rotation_seconds: res.tv_rotation_seconds,
          tv_locale_mode: res.tv_locale_mode,
          tv_locale_primary: res.tv_locale_primary,
          tv_locale_secondary: res.tv_locale_secondary,
          tv_locale_rotate_seconds: res.tv_locale_rotate_seconds,
          tv_bg_color: res.tv_bg_color,
          tv_text_color: res.tv_text_color,
          tv_accent_color: res.tv_accent_color,
          tv_announcement_text: res.tv_announcement_text,
          tv_announcement_text_secondary: res.tv_announcement_text_secondary,
          tv_show_hijri: res.tv_show_hijri,
          tv_show_arabic_prayer_names: res.tv_show_arabic_prayer_names,
          tv_highlight_active_prayer: res.tv_highlight_active_prayer,
          tv_highlight_duration_seconds: res.tv_highlight_duration_seconds,
        });
      }
      setIsLoading(false);
    });
  }, [mosqueId]);

  const set = useCallback(<K extends keyof TVForm>(key: K, val: TVForm[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
  }, []);

  // DnD
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = form.tv_slide_order.indexOf(active.id as TVModuleKey);
    const newIndex = form.tv_slide_order.indexOf(over.id as TVModuleKey);
    if (oldIndex === -1 || newIndex === -1) return;
    set("tv_slide_order", arrayMove(form.tv_slide_order, oldIndex, newIndex));
  }

  // Save
  async function handleSave() {
    setIsSaving(true);
    setStatus(null);
    setWarnings([]);

    const res = await updateTVSettings(mosqueId, userId, {
      tv_enabled: form.tv_enabled,
      tv_modules: form.tv_modules,
      tv_slide_order: form.tv_slide_order,
      tv_module_counts: form.tv_module_counts as Record<TVModuleKey, number>,
      tv_rotation_seconds: form.tv_rotation_seconds,
      tv_locale_mode: form.tv_locale_mode,
      tv_locale_primary: form.tv_locale_primary as "de" | "tr" | "ar" | "en",
      tv_locale_secondary: form.tv_locale_secondary as "de" | "tr" | "ar" | "en" | "none",
      tv_locale_rotate_seconds: form.tv_locale_rotate_seconds,
      tv_bg_color: form.tv_bg_color,
      tv_text_color: form.tv_text_color,
      tv_accent_color: form.tv_accent_color,
      tv_announcement_text: form.tv_announcement_text,
      tv_announcement_text_secondary: form.tv_announcement_text_secondary,
      tv_show_hijri: form.tv_show_hijri,
      tv_show_arabic_prayer_names: form.tv_show_arabic_prayer_names,
      tv_highlight_active_prayer: form.tv_highlight_active_prayer,
      tv_highlight_duration_seconds: form.tv_highlight_duration_seconds,
    });

    setIsSaving(false);

    if (!res.success) {
      setStatus({ type: "error", message: res.error || "Fehler beim Speichern" });
    } else {
      if (res.warnings && res.warnings.length > 0) {
        setWarnings(res.warnings);
        setStatus({ type: "warning", message: "Gespeichert — Kontrast-Hinweise beachten" });
      } else {
        setStatus({ type: "success", message: "TV-Einstellungen gespeichert" });
      }
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(tvUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  const showSecondary = form.tv_locale_mode !== "single";
  const showRotateSlider = form.tv_locale_mode === "rotate";

  return (
    <div className="space-y-6">

      {/* Status */}
      {status && (
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ${
            status.type === "success"
              ? "bg-emerald-50 text-emerald-700"
              : status.type === "warning"
              ? "bg-amber-50 text-amber-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {status.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : status.type === "warning" ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <X className="h-4 w-4" />
          )}
          {status.message}
        </div>
      )}

      {/* Contrast warnings */}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Kontrast-Hinweise (Einstellungen wurden gespeichert)
          </div>
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <li key={i} className="text-sm text-amber-700">• {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 1. Grundeinstellungen ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-gray-900">Grundeinstellungen</h2>
          <p className="mt-1 text-sm text-gray-500">TV-Anzeige aktivieren und URL teilen</p>
        </div>

        {/* Master switch */}
        <div className="mb-5 flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-800">TV-Anzeige aktiv</p>
            <p className="text-xs text-gray-500">Öffentliche Seite für Eingangshallen-Monitor</p>
          </div>
          <button
            type="button"
            onClick={() => set("tv_enabled", !form.tv_enabled)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors ${
              form.tv_enabled ? "bg-emerald-500" : "bg-gray-200"
            }`}
            aria-pressed={form.tv_enabled}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                form.tv_enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* URL box */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">TV-Link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate text-sm font-mono text-gray-700">{tvUrl}</code>
            <button
              type="button"
              onClick={copyUrl}
              className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs hover:bg-white"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Kopiert" : "Kopieren"}
            </button>
            <a
              href={tvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs hover:bg-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Öffnen
            </a>
          </div>
        </div>
      </div>

      {/* ── 2. Sprache & Anzeige ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-gray-900">Sprache & Anzeige</h2>
          <p className="mt-1 text-sm text-gray-500">Wie werden Texte auf dem TV angezeigt?</p>
        </div>

        <div className="space-y-4">
          {/* Mode */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Sprach-Modus</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(["single", "rotate", "bilingual"] as TVLocaleMode[]).map((mode) => {
                const labels = { single: "Einzelsprache", rotate: "Wechselnd", bilingual: "Zweisprachig" };
                const descs = {
                  single: "Nur eine Sprache",
                  rotate: "Wechselt automatisch",
                  bilingual: "Beide gleichzeitig",
                };
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => set("tv_locale_mode", mode)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                      form.tv_locale_mode === mode
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="font-medium">{labels[mode]}</p>
                    <p className="text-xs text-gray-500">{descs[mode]}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary locale */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Hauptsprache</label>
              <select
                value={form.tv_locale_primary}
                onChange={(e) => set("tv_locale_primary", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {Object.entries(LOCALE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* Secondary locale */}
            {showSecondary && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Zweitsprache</label>
                <select
                  value={form.tv_locale_secondary}
                  onChange={(e) => set("tv_locale_secondary", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="none">Keine</option>
                  {Object.entries(LOCALE_LABELS).map(([k, v]) => (
                    <option key={k} value={k} disabled={k === form.tv_locale_primary}>{v}</option>
                  ))}
                </select>
                {form.tv_locale_secondary !== "none" && form.tv_locale_secondary === form.tv_locale_primary && (
                  <p className="mt-1 text-xs text-red-600">Haupt- und Zweitsprache müssen unterschiedlich sein</p>
                )}
              </div>
            )}
          </div>

          {/* Rotate seconds */}
          {showRotateSlider && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Sprachwechsel alle <span className="font-bold text-emerald-600">{form.tv_locale_rotate_seconds} s</span>
              </label>
              <input
                type="range"
                min={3}
                max={30}
                value={form.tv_locale_rotate_seconds}
                onChange={(e) => set("tv_locale_rotate_seconds", parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>3 s</span><span>30 s</span>
              </div>
            </div>
          )}

          {/* Arabic prayer names + Hijri */}
          <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.tv_show_arabic_prayer_names}
                onChange={(e) => set("tv_show_arabic_prayer_names", e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-600"
              />
              <span className="text-sm text-gray-700">Arabische Gebetsnamen anzeigen (الفجر, الظهر, …)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.tv_show_hijri}
                onChange={(e) => set("tv_show_hijri", e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-600"
              />
              <span className="text-sm text-gray-700">Hijri-Datum anzeigen</span>
            </label>
          </div>
        </div>
      </div>

      {/* ── 3. Module & Reihenfolge ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-gray-900">Module & Reihenfolge</h2>
          <p className="mt-1 text-sm text-gray-500">
            Module aktivieren/deaktivieren und per Drag & Drop sortieren
          </p>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={form.tv_slide_order}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {form.tv_slide_order.map((key) => (
                <SortableModuleRow
                  key={key}
                  moduleKey={key}
                  enabled={form.tv_modules[key]}
                  count={form.tv_module_counts[key]}
                  onToggle={() =>
                    set("tv_modules", { ...form.tv_modules, [key]: !form.tv_modules[key] })
                  }
                  onCountChange={(v) =>
                    set("tv_module_counts", { ...form.tv_module_counts, [key]: v })
                  }
                />
              ))}
              {/* Show any missing keys at bottom */}
              {TV_MODULE_KEYS.filter((k) => !form.tv_slide_order.includes(k)).map((key) => (
                <SortableModuleRow
                  key={key}
                  moduleKey={key}
                  enabled={form.tv_modules[key]}
                  count={form.tv_module_counts[key]}
                  onToggle={() =>
                    set("tv_modules", { ...form.tv_modules, [key]: !form.tv_modules[key] })
                  }
                  onCountChange={(v) =>
                    set("tv_module_counts", { ...form.tv_module_counts, [key]: v })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* ── 4. Rotation ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-gray-900">Rotation & Adhan</h2>
        </div>

        <div className="space-y-5">
          {/* Slide speed */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Slide-Wechsel alle <span className="font-bold text-emerald-600">{form.tv_rotation_seconds} s</span>
            </label>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={form.tv_rotation_seconds}
              onChange={(e) => set("tv_rotation_seconds", parseInt(e.target.value, 10))}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>5 s</span><span>2 min</span>
            </div>
          </div>

          {/* Highlight */}
          <div className="border-t border-gray-100 pt-4">
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={form.tv_highlight_active_prayer}
                onChange={(e) => set("tv_highlight_active_prayer", e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-600"
              />
              <span className="text-sm font-medium text-gray-700">Adhan-Highlight aktivieren</span>
            </label>
            <div className="ml-7 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700 flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              Adhan = eingetretene Gebetszeit. Zeigt Vollbild-Overlay für die gewählte Dauer.
              Iqama-Versatz wird in einer späteren Version separat eingestellt.
            </div>

            {form.tv_highlight_active_prayer && (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Highlight-Dauer: <span className="font-bold text-emerald-600">{Math.round(form.tv_highlight_duration_seconds / 60)} min ({form.tv_highlight_duration_seconds} s)</span>
                </label>
                <input
                  type="range"
                  min={60}
                  max={900}
                  step={60}
                  value={form.tv_highlight_duration_seconds}
                  onChange={(e) => set("tv_highlight_duration_seconds", parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-600"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>1 min</span><span>15 min</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 5. Farben ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-gray-900">Farben</h2>
          <p className="mt-1 text-sm text-gray-500">
            Leer lassen = Brand-Farben der Moschee verwenden. HEX-Format: #1a2b3c
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <ColorField
            label="Hintergrundfarbe"
            value={form.tv_bg_color}
            onChange={(v) => set("tv_bg_color", v)}
            placeholder="#0a0a0a"
            contrastWith={form.tv_text_color || "#fafafa"}
          />
          <ColorField
            label="Textfarbe"
            value={form.tv_text_color}
            onChange={(v) => set("tv_text_color", v)}
            placeholder="#fafafa"
            contrastWith={form.tv_bg_color || "#0a0a0a"}
          />
          <ColorField
            label="Akzentfarbe"
            value={form.tv_accent_color}
            onChange={(v) => set("tv_accent_color", v)}
            placeholder="#16a34a"
            contrastWith={form.tv_bg_color || "#0a0a0a"}
          />
        </div>

        {/* Live preview swatch */}
        {(form.tv_bg_color || form.tv_text_color || form.tv_accent_color) && (
          <div
            className="mt-4 flex items-center justify-center rounded-lg px-6 py-4 text-center"
            style={{
              backgroundColor: form.tv_bg_color || "#0a0a0a",
              color: form.tv_text_color || "#fafafa",
            }}
          >
            <div>
              <p className="text-lg font-bold" style={{ color: form.tv_accent_color || "#16a34a" }}>
                Nächstes Gebet · Sıradaki namaz
              </p>
              <p className="mt-1 text-sm">Asr / İkindi — 15:42</p>
            </div>
          </div>
        )}
      </div>

      {/* ── 6. Ankündigung ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-gray-900">Freitext-Ankündigung</h2>
          <p className="mt-1 text-sm text-gray-500">
            Wird nur angezeigt wenn Modul &quot;Ankündigung&quot; aktiviert ist.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Text ({LOCALE_LABELS[form.tv_locale_primary] || "Hauptsprache"})
              <span className="ml-2 text-xs text-gray-400">{form.tv_announcement_text.length}/500</span>
            </label>
            <textarea
              value={form.tv_announcement_text}
              onChange={(e) => set("tv_announcement_text", e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="z.B. Willkommen in unserer Moschee 🌙"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {showSecondary && form.tv_locale_secondary !== "none" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Text ({LOCALE_LABELS[form.tv_locale_secondary] || "Zweitsprache"})
                <span className="ml-2 text-xs text-gray-400">{form.tv_announcement_text_secondary.length}/500</span>
              </label>
              <textarea
                value={form.tv_announcement_text_secondary}
                onChange={(e) => set("tv_announcement_text_secondary", e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="z.B. Camimize hoş geldiniz 🌙"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Save ── */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-4">
        <a
          href={tvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Tv className="h-4 w-4" />
          Vorschau öffnen
        </a>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Wird gespeichert…" : "Speichern"}
        </button>
      </div>
    </div>
  );
}
