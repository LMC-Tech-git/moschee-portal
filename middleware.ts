import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// next-intl Middleware für Locale-Detection (Cookie + Accept-Language)
const intlMiddleware = createIntlMiddleware(routing);

/**
 * Middleware: Schützt Admin- und Member-Routen.
 * PocketBase Auth wird clientseitig über den AuthContext gehandhabt.
 * Diese Middleware leitet unauthentifizierte Nutzer um.
 *
 * V1: /admin/* und /member/* sind geschützt.
 * /[slug]/* ist öffentlich (Slug-basierte Public-Seiten).
 *
 * Subdomain-Routing: demo.moschee.app/* → /demo/*
 * i18n: Cookie `NEXT_LOCALE` oder Accept-Language-Header → de/tr
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  // ── Demo-Subdomain: demo.moschee.app → /demo/* ─────────────────────────────
  const demoSlug = process.env.NEXT_PUBLIC_DEMO_SLUG || "demo";
  const demoDomain = `demo.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "moschee.app"}`;

  if (hostname === demoDomain) {
    // Routen die NICHT umgeschrieben werden sollen
    const PASS_THROUGH = [
      "/admin", "/member", "/lehrer", "/imam",
      "/login", "/register", "/api", "/invite",
      `/${demoSlug}`, // bereits umgeschrieben (verhindert Doppel-Rewrite)
    ];
    const needsRewrite = !PASS_THROUGH.some((p) => pathname.startsWith(p));

    if (needsRewrite) {
      const url = request.nextUrl.clone();
      url.pathname = `/${demoSlug}${pathname === "/" ? "" : pathname}`;
      const rewriteResponse = NextResponse.rewrite(url);
      // next-intl Locale-Detection trotzdem ausführen (setzt NEXT_LOCALE Cookie)
      const intlResponse = intlMiddleware(request);
      const localeCookie = intlResponse.cookies.get("NEXT_LOCALE");
      if (localeCookie) {
        rewriteResponse.cookies.set(localeCookie.name, localeCookie.value, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
        });
      }
      return rewriteResponse;
    }
  }

  // ── moschee.app/demo → demo.moschee.app ────────────────────────────────────
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "moschee.app";
  if (
    (hostname === rootDomain || hostname === `www.${rootDomain}`) &&
    (pathname === `/${demoSlug}` || pathname.startsWith(`/${demoSlug}/`))
  ) {
    const subpath = pathname.slice(`/${demoSlug}`.length) || "/";
    return NextResponse.redirect(`https://${demoDomain}${subpath}`);
  }

  // PocketBase speichert Auth-Token im Cookie "pb_auth"
  const authCookie = request.cookies.get("pb_auth");

  // Protected routes prüfen
  const isProtectedRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/member") ||
    pathname.startsWith("/lehrer") ||
    pathname.startsWith("/imam") ||
    pathname.startsWith("/mitglieder"); // Legacy, wird in Phase 6 entfernt

  if (isProtectedRoute && !authCookie?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Locale-Prefix entfernen ──────────────────────────────────────────────────
  // next-intl kann trotz localePrefix: 'never' manchmal auf /de/* umleiten.
  // Solche Pfade sofort auf den Pfad ohne Locale-Präfix umleiten.
  const localeMatch = pathname.match(/^\/(de|tr)(\/.*)?$/);
  if (localeMatch) {
    const strippedPath = localeMatch[2] || "/";
    const url = request.nextUrl.clone();
    url.pathname = strippedPath;
    return NextResponse.redirect(url);
  }

  // next-intl Locale-Detection (setzt NEXT_LOCALE Cookie basierend auf Accept-Language)
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|sw\\.js|manifest\\.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
