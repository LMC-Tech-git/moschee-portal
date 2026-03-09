"use client";

import { useState } from "react";
import { Copy, Check, Link2, Users, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createInvite } from "@/lib/actions/invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onClose: () => void;
  mosqueId: string;
  mosqueSlug: string;
  adminUserId: string;
  onSuccess: () => void;
}

type InviteType = "personal" | "group";
type Step = "form" | "success";

const ROLE_OPTIONS = [
  { value: "member", label: "Mitglied" },
  { value: "imam", label: "Imam" },
  { value: "teacher", label: "Lehrer/in" },
  { value: "admin", label: "Administrator" },
] as const;

export function CreateInviteDialog({
  open,
  onClose,
  mosqueId,
  mosqueSlug,
  adminUserId,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<Step>("form");
  const [inviteType, setInviteType] = useState<InviteType>("personal");
  const [role, setRole] = useState<"member" | "teacher" | "imam" | "admin">("member");
  const [initialStatus, setInitialStatus] = useState<"pending" | "active">("pending");
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdLink, setCreatedLink] = useState("");
  const [copied, setCopied] = useState(false);

  function resetForm() {
    setStep("form");
    setInviteType("personal");
    setRole("member");
    setInitialStatus("pending");
    setLabel("");
    setEmail("");
    setMaxUses("");
    setExpiresAt("");
    setError("");
    setCreatedLink("");
    setCopied(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleCreate() {
    setError("");

    if (inviteType === "group" && !label.trim()) {
      setError("Bitte gib einen Namen für die Gruppeneinladung ein.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await createInvite(mosqueId, adminUserId, {
        type: inviteType,
        label: label.trim() || undefined,
        email: email.trim() || undefined,
        role,
        initial_status: initialStatus,
        max_uses: maxUses ? parseInt(maxUses, 10) : undefined,
        expires_at: expiresAt || undefined,
      });

      if (!result.success || !result.data) {
        setError(result.error || "Einladung konnte nicht erstellt werden.");
        return;
      }

      const token = result.data.token;
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/${mosqueSlug}/invite/${token}`;
      setCreatedLink(link);
      setStep("success");
      onSuccess();
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(createdLink);
      setCopied(true);
      toast.success("Link in die Zwischenablage kopiert!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopieren fehlgeschlagen. Bitte manuell kopieren.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>Neue Einladung erstellen</DialogTitle>
              <DialogDescription>
                Erstelle einen Einladungslink für deine Gemeinde.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              {/* Einladungstyp */}
              <div className="space-y-2">
                <Label>Einladungstyp</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteType("personal")}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors ${
                      inviteType === "personal"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <UserPlus className="h-5 w-5" />
                    <span className="font-medium">Persönlich</span>
                    <span className="text-xs text-gray-500">Einmalig nutzbar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteType("group")}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors ${
                      inviteType === "group"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Users className="h-5 w-5" />
                    <span className="font-medium">Gruppe</span>
                    <span className="text-xs text-gray-500">Mehrfach nutzbar</span>
                  </button>
                </div>
              </div>

              {/* Gruppenspezifisch: Label (Pflicht) */}
              {inviteType === "group" && (
                <div className="space-y-2">
                  <Label htmlFor="label">
                    Name / Bezeichnung <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="label"
                    placeholder="z.B. WhatsApp Gruppe Schwesternkreis"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    maxLength={100}
                  />
                </div>
              )}

              {/* Persönlich: E-Mail optional */}
              {inviteType === "personal" && (
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="eingeladene@person.de"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Wird im Registrierungsformular vorausgefüllt.
                  </p>
                </div>
              )}

              {/* Rolle */}
              <div className="space-y-2">
                <Label>Rolle nach Registrierung</Label>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Initialer Status */}
              <div className="space-y-2">
                <Label>Status nach Registrierung</Label>
                <Select
                  value={initialStatus}
                  onValueChange={(v) => setInitialStatus(v as typeof initialStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Ausstehend (muss aktiviert werden)</SelectItem>
                    <SelectItem value="active">Direkt aktiv</SelectItem>
                  </SelectContent>
                </Select>
                {inviteType === "group" && initialStatus === "active" && (
                  <p className="text-xs text-amber-600">
                    Hinweis: Gruppeneinladungen empfehlen &quot;Ausstehend&quot; für mehr Kontrolle.
                  </p>
                )}
              </div>

              {/* Gruppenspezifisch: max_uses + expires_at */}
              {inviteType === "group" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="max_uses">Max. Nutzungen</Label>
                    <Input
                      id="max_uses"
                      type="number"
                      min={1}
                      placeholder="z.B. 50"
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Leer = unbegrenzt</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expires_at">Gültig bis</Label>
                    <Input
                      id="expires_at"
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                Abbrechen
              </Button>
              <Button onClick={handleCreate} disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent motion-reduce:animate-none" />
                    Erstelle…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Link erstellen
                  </span>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-emerald-600" />
                Einladungslink erstellt
              </DialogTitle>
              <DialogDescription>
                Kopiere den Link und teile ihn mit der eingeladenen Person
                {inviteType === "group" ? "en" : ""}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Einladungslink</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={createdLink}
                    className="font-mono text-xs"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    variant={copied ? "outline" : "default"}
                    size="icon"
                    onClick={copyLink}
                    aria-label="Link kopieren"
                    className="flex-shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-amber-600">
                  Dieser Link wird nur einmalig angezeigt. Bitte jetzt kopieren und sicher
                  aufbewahren.
                </p>
              </div>

              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
                <p>
                  <span className="font-medium">Typ:</span>{" "}
                  {inviteType === "personal" ? "Persönlich (1×)" : "Gruppe (mehrfach)"}
                </p>
                <p>
                  <span className="font-medium">Rolle:</span>{" "}
                  {{ member: "Mitglied", imam: "Imam", teacher: "Lehrer/in", admin: "Administrator" }[role]}
                </p>
                <p>
                  <span className="font-medium">Status:</span>{" "}
                  {initialStatus === "active" ? "Direkt aktiv" : "Ausstehend"}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={copyLink} className="flex-1">
                {copied ? (
                  <span className="flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Kopiert!
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Copy className="h-4 w-4" />
                    Link kopieren
                  </span>
                )}
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Schließen
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
