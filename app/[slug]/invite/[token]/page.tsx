import { notFound } from "next/navigation";
import { XCircle } from "lucide-react";
import { resolveMosqueBySlug } from "@/lib/resolve-mosque";
import { validateInviteByToken } from "@/lib/actions/invites";
import { InviteRegistrationForm } from "@/components/invites/InviteRegistrationForm";

interface Props {
  params: { slug: string; token: string };
}

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "Diese Einladung existiert nicht oder wurde bereits entfernt.",
  revoked: "Diese Einladung wurde vom Administrator widerrufen.",
  expired: "Diese Einladung ist abgelaufen.",
  exhausted: "Diese Einladung wurde bereits vollständig genutzt.",
  error: "Fehler beim Laden der Einladung. Bitte versuche es später erneut.",
};

function InviteErrorPage({
  reason,
  mosqueName,
}: {
  reason?: string;
  mosqueName: string;
}) {
  const message = ERROR_MESSAGES[reason ?? "error"] ?? ERROR_MESSAGES.error;

  return (
    <section className="flex min-h-[80vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <XCircle className="h-7 w-7 text-red-500" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-gray-800">Einladung ungültig</h1>
        <p className="mb-6 text-gray-500">{message}</p>
        <p className="text-sm text-gray-400">
          Gemeinde: <span className="font-medium text-gray-600">{mosqueName}</span>
        </p>
        <p className="mt-4 text-sm text-gray-500">
          Bitte wende dich an den Administrator der Gemeinde, um eine neue Einladung zu erhalten.
        </p>
      </div>
    </section>
  );
}

export default async function InvitePage({ params }: Props) {
  // Moschee via Slug auflösen — 404 wenn ungültig
  const mosque = await resolveMosqueBySlug(params.slug);
  if (!mosque) {
    notFound();
  }

  // Invite validieren (server-side, Tenant-Prüfung inbegriffen)
  const result = await validateInviteByToken(params.token, mosque.id);

  if (!result.valid) {
    return <InviteErrorPage reason={result.reason} mosqueName={mosque.name} />;
  }

  const invite = result.invite!;

  return (
    <InviteRegistrationForm
      mosqueName={mosque.name}
      mosqueSlug={params.slug}
      token={params.token}
      inviteType={invite.type}
      inviteLabel={invite.label || null}
      defaultEmail={invite.email || null}
      inviteRole={invite.role}
    />
  );
}
