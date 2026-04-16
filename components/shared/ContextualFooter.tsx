import { headers } from "next/headers";
import { resolveMosqueWithSettings } from "@/lib/resolve-mosque";
import Footer from "./Footer";

/**
 * Liest den aktuellen Hostname und gibt den Kontakt-Link im Footer
 * nur dann frei, wenn contact_enabled für diese Moschee aktiviert ist.
 * Auf der Root-Domain (moschee.app) ist der Link immer ausgeblendet.
 */
export async function ContextualFooter() {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "moschee.app";
  const hostname = (await headers()).get("host") || "";

  const isSubdomain =
    hostname !== rootDomain &&
    hostname !== `www.${rootDomain}` &&
    hostname.endsWith(`.${rootDomain}`);

  if (!isSubdomain) {
    return <Footer contactEnabled={false} showGuideLink />;
  }

  const slug = hostname.replace(`.${rootDomain}`, "");
  const result = await resolveMosqueWithSettings(slug);

  return <Footer contactEnabled={result?.settings?.contact_enabled ?? false} />;
}
