"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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

export function CreateInviteDialog({
  open,
  onClose,
  mosqueId,
  mosqueSlug,
  adminUserId,
  onSuccess,
}: Props) {
  const tI = useTranslations("invites");
  const tL = useTranslations("labels");
  const tCommon = useTranslations("common");

  const roleOptions = [
    { value: "member", label: tL("role.member") },
    { value: "imam", label: tL("role.imam") },
    { value: "teacher", label: tL("role.teacher") },
    { value: "editor", label: tL("role.editor") },
    { value: "admin", label: tL("role.admin") },
  ];

  const [step, setStep] = useState<Step>("form");
  const [inviteType, setInviteType] = useState<InviteType>("personal");
  const [role, setRole] = useState<"member" | "teacher" | "imam" | "editor" | "admin">("member");
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
      setError(tI("errors.nameRequired"));
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
        setError(result.error || tI("errors.createFailed"));
        return;
      }

      const token = result.data.token;
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/${mosqueSlug}/invite/${token}`;
      setCreatedLink(link);
      setStep("success");
      onSuccess();
    } catch {
      setError(tI("errors.unexpected"));
    } finally {
      setIsLoading(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(createdLink);
      setCopied(true);
      toast.success(tI("toast.linkCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(tI("toast.copyFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>{tI("dialog.title")}</DialogTitle>
              <DialogDescription>
                {tI("dialog.desc")}
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
                <Label>{tI("dialog.typeLabel")}</Label>
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
                    <span className="font-medium">{tI("dialog.personal")}</span>
                    <span className="text-xs text-gray-500">{tI("dialog.personalHint")}</span>
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
                    <span className="font-medium">{tI("dialog.group")}</span>
                    <span className="text-xs text-gray-500">{tI("dialog.groupHint")}</span>
                  </button>
                </div>
              </div>

              {/* Gruppenspezifisch: Label (Pflicht) */}
              {inviteType === "group" && (
                <div className="space-y-2">
                  <Label htmlFor="label">
                    {tI("dialog.nameLabel")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="label"
                    placeholder={tI("dialog.namePlaceholder")}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    maxLength={100}
                  />
                </div>
              )}

              {/* Persönlich: E-Mail optional */}
              {inviteType === "personal" && (
                <div className="space-y-2">
                  <Label htmlFor="email">{tI("dialog.emailLabel")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={tI("dialog.emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    {tI("dialog.emailHint")}
                  </p>
                </div>
              )}

              {/* Rolle */}
              <div className="space-y-2">
                <Label>{tI("dialog.roleLabel")}</Label>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Initialer Status */}
              <div className="space-y-2">
                <Label>{tI("dialog.statusLabel")}</Label>
                <Select
                  value={initialStatus}
                  onValueChange={(v) => setInitialStatus(v as typeof initialStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{tI("dialog.statusPending")}</SelectItem>
                    <SelectItem value="active">{tI("dialog.statusActive")}</SelectItem>
                  </SelectContent>
                </Select>
                {inviteType === "group" && initialStatus === "active" && (
                  <p className="text-xs text-amber-600">
                    {tI("dialog.groupWarning")}
                  </p>
                )}
              </div>

              {/* Gruppenspezifisch: max_uses + expires_at */}
              {inviteType === "group" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="max_uses">{tI("dialog.maxUsesLabel")}</Label>
                    <Input
                      id="max_uses"
                      type="number"
                      min={1}
                      placeholder={tI("dialog.maxUsesPlaceholder")}
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">{tI("dialog.maxUsesHint")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expires_at">{tI("dialog.expiryLabel")}</Label>
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
                {tCommon("cancel")}
              </Button>
              <Button onClick={handleCreate} disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent motion-reduce:animate-none" />
                    {tI("dialog.submitting")}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    {tI("dialog.submit")}
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
                {tI("dialog.successTitle")}
              </DialogTitle>
              <DialogDescription>
                {inviteType === "group" ? tI("dialog.successDescGroup") : tI("dialog.successDescPersonal")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{tI("dialog.linkLabel")}</Label>
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
                    aria-label={tI("dialog.copyLink")}
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
                  {tI("dialog.warningOnce")}
                </p>
              </div>

              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
                <p>
                  <span className="font-medium">{tI("dialog.typeRow")}</span>{" "}
                  {inviteType === "personal" ? tI("dialog.typePersonal") : tI("dialog.typeGroup")}
                </p>
                <p>
                  <span className="font-medium">{tI("dialog.roleRow")}</span>{" "}
                  {roleOptions.find((o) => o.value === role)?.label ?? role}
                </p>
                <p>
                  <span className="font-medium">{tI("dialog.statusRow")}</span>{" "}
                  {initialStatus === "active" ? tI("dialog.statusDisplayActive") : tI("dialog.statusDisplayPending")}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={copyLink} className="flex-1">
                {copied ? (
                  <span className="flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    {tI("dialog.copyLink")}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Copy className="h-4 w-4" />
                    {tI("dialog.copyLink")}
                  </span>
                )}
              </Button>
              <Button variant="outline" onClick={handleClose}>
                {tCommon("cancel")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
