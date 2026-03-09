import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware: Schützt Admin- und Member-Routen.
 * PocketBase Auth wird clientseitig über den AuthContext gehandhabt.
 * Diese Middleware leitet unauthentifizierte Nutzer um.
 *
 * V1: /admin/* und /member/* sind geschützt.
 * /[slug]/* ist öffentlich (Slug-basierte Public-Seiten).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // PocketBase speichert Auth-Token im Cookie "pb_auth"
  const authCookie = request.cookies.get("pb_auth");

  // Protected routes prüfen
  const isProtectedRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/member") ||
    pathname.startsWith("/mitglieder"); // Legacy, wird in Phase 6 entfernt

  if (isProtectedRoute && !authCookie?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|sw\\.js|manifest\\.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
