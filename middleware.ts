import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["de", "tr"] as const;
type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = "de";

/**
 * Locale aus Cookie oder Accept-Language-Header ermitteln.
 * Kein Redirect, kein createIntlMiddleware — nur Cookie lesen + Header setzen.
 */
function detectLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookie && (LOCALES as readonly string[]).includes(cookie)) {
    return cookie as Locale;
  }
  const acceptLang = request.headers.get("accept-language") || "";
  if (acceptLang.toLowerCase().startsWith("tr")) {
    return "tr";
  }
  return DEFAULT_LOCALE;
}

/**
 * Locale-Cookie und x-next-intl-locale-Header auf eine Response setzen.
 * x-next-intl-locale wird von next-intl getRequestConfig() als requestLocale gelesen.
 */
function applyLocale(response: NextResponse, request: NextRequest): NextResponse {
  const locale = detectLocale(request);
  response.headers.set("x-next-intl-locale", locale);
  // Cookie nur setzen wenn noch nicht vorhanden (nicht bei jeder Anfrage überschreiben)
  if (!request.cookies.get("NEXT_LOCALE")) {
    response.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  return response;
}

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
 *        (manuell, ohne createIntlMiddleware um Locale-Prefix-Redirects zu vermeiden)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  // ── Generisch: {slug}.moschee.app/* → /{slug}/* ────────────────────────────
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "moschee.app";

  if (hostname.endsWith(`.${rootDomain}`) && hostname !== `www.${rootDomain}`) {
    const slug = hostname.replace(`.${rootDomain}`, "");
    const PASS_THROUGH = [
      `/${slug}`,   // Verhindert Doppel-Rewrite bei bestehenden /{slug}/... Links
      "/login", "/register", "/api",
      "/admin", "/member", "/lehrer", "/imam",
      "/impressum", "/datenschutz", "/agb",
      "/passwort-vergessen", "/passwort-zuruecksetzen",
    ];
    const needsRewrite = !PASS_THROUGH.some((p) => pathname.startsWith(p));

    if (needsRewrite) {
      const url = request.nextUrl.clone();
      url.pathname = `/${slug}${pathname === "/" ? "" : pathname}`;
      return applyLocale(NextResponse.rewrite(url), request);
    }
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

  // ── Locale-Prefix-Schutz ─────────────────────────────────────────────────
  // Sicherheitsnetz: Falls irgendwo /de/* oder /tr/* aufgerufen wird,
  // sofort auf den Pfad ohne Locale-Präfix umleiten.
  const localeMatch = pathname.match(/^\/(de|tr)(\/.*)?$/);
  if (localeMatch) {
    const strippedPath = localeMatch[2] || "/";
    const url = request.nextUrl.clone();
    url.pathname = strippedPath;
    return NextResponse.redirect(url);
  }

  // ── Locale-Detection ohne Redirect ──────────────────────────────────────
  // Locale aus Cookie/Accept-Language ermitteln und als Header + Cookie setzen.
  // next-intl liest x-next-intl-locale in getRequestConfig() als requestLocale.
  return applyLocale(NextResponse.next(), request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|sw\\.js|manifest\\.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
