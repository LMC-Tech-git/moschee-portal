"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import {
  Home,
  Menu,
  X,
  LogIn,
  User,
  Shield,
  FileText,
  CalendarDays,
  Target,
  Heart,
  Users,
  Mail,
  LogOut,
  GraduationCap,
  BookOpen,
  Megaphone,
  Settings,
  Crown,
  Edit3,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useMosque } from "@/lib/mosque-context";

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || "";

const adminLinks = [
  { label: "Dashboard", href: "/admin", icon: Shield },
  { label: "Beiträge", href: "/admin/posts", icon: FileText },
  { label: "Veranstaltungen", href: "/admin/events", icon: CalendarDays },
  { label: "Mitglieder", href: "/admin/mitglieder", icon: Users },
  { label: "Kampagnen", href: "/admin/kampagnen", icon: Target },
  { label: "Madrasa", href: "/admin/madrasa", icon: BookOpen },
  { label: "Newsletter", href: "/admin/newsletter", icon: Mail },
  { label: "Einstellungen", href: "/admin/settings", icon: Settings },
];


const AVATAR_GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-blue-400 to-indigo-600",
  "from-violet-400 to-purple-600",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-600",
  "from-teal-400 to-cyan-600",
  "from-sky-400 to-blue-600",
  "from-fuchsia-400 to-violet-600",
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { mosque } = useMosque();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin" || user?.role === "editor";
  const isSuperAdmin = user?.role === "super_admin";
  const isEditor = user?.role === "editor";
  const isTeacher = user?.role === "teacher";
  const isImam = user?.role === "imam";
  // URL-Slug hat Vorrang auf öffentlichen Moschee-Seiten (verhindert falsche Links bei eingeloggten Usern)
  const HEADER_RESERVED = ['admin','member','lehrer','imam','login','register','api','invite'];
  const pathParts = pathname.split('/').filter(Boolean);
  const urlSlug = pathParts.length > 0 && !HEADER_RESERVED.includes(pathParts[0]) ? pathParts[0] : null;
  const slug = urlSlug ?? mosque?.slug;

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  // Escape-Taste schließt mobiles Menü
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMobileMenu();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen, closeMobileMenu]);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm print:hidden">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          {mosque?.brand_logo && mosque?.id ? (
            <div className="relative h-10 w-10">
              <Image
                src={`${PB_URL}/api/files/mosques/${mosque.id}/${mosque.brand_logo}`}
                alt={mosque.name || "Logo"}
                fill
                className="object-contain"
                sizes="40px"
              />
            </div>
          ) : (
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${
                AVATAR_GRADIENTS[(mosque?.id?.charCodeAt(0) ?? 0) % AVATAR_GRADIENTS.length]
              }`}
            >
              <span className="text-base font-bold text-white" aria-hidden="true">
                {mosque?.name?.charAt(0)?.toUpperCase() ?? "M"}
              </span>
            </div>
          )}
          <div>
            <span className="text-lg font-bold text-emerald-700">
              {mosque?.name || "moschee.app"}
            </span>
            <span className="hidden text-xs text-gray-500 sm:block">
              {mosque ? mosque.city || "Ihre digitale Gemeinde" : "Die Plattform für Moscheegemeinden"}
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-1 lg:flex">
          {/* Moschee-Dashboard (für alle eingeloggten User) */}
          {slug && (
            <Link
              href={`/${slug}`}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Startseite
            </Link>
          )}

          {/* Öffentliche Seiten (für alle wenn slug bekannt) */}
          {slug && (
            <>
              <Link
                href={`/${slug}/events`}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
              >
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Veranstaltungen
              </Link>
              <Link
                href={`/${slug}/donate`}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
              >
                <Heart className="h-4 w-4" aria-hidden="true" />
                Spenden
              </Link>
            </>
          )}

          {/* Startseite wenn kein Slug */}
          {!slug && (
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Startseite
            </Link>
          )}
        </div>

        {/* Auth & CTA */}
        <div className="hidden items-center gap-3 lg:flex">
          {isAuthenticated ? (
            <>
              <Link
                href="/member/profile"
                className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-emerald-600"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                {user?.first_name || user?.full_name}
              </Link>
              {isSuperAdmin && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 rounded-lg bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
                >
                  <Crown className="h-4 w-4" aria-hidden="true" />
                  Plattform
                </Link>
              )}
              {user?.role === "admin" && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-100"
                >
                  <Shield className="h-4 w-4" aria-hidden="true" />
                  Admin
                </Link>
              )}
              {isEditor && (
                <Link
                  href="/admin/posts"
                  className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100"
                >
                  <Edit3 className="h-4 w-4" aria-hidden="true" />
                  Editor
                </Link>
              )}
              {isTeacher && (
                <Link
                  href="/lehrer"
                  className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100"
                >
                  <GraduationCap className="h-4 w-4" aria-hidden="true" />
                  Lehrer
                </Link>
              )}
              {isImam && (
                <Link
                  href="/imam"
                  className="flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-2 text-sm font-medium text-violet-600 hover:bg-violet-100"
                >
                  <Megaphone className="h-4 w-4" aria-hidden="true" />
                  Imam
                </Link>
              )}
              <button
                onClick={logout}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Abmelden
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Anmelden
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                Registrieren
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="rounded-lg p-2 text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </nav>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="border-t border-gray-100 bg-white px-4 pb-4 lg:hidden">
          {/* Moschee-Seiten */}
          {slug ? (
            <>
              <Link
                href={`/${slug}`}
                className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-600"
                onClick={closeMobileMenu}
              >
                <Home className="h-4 w-4" />
                Startseite
              </Link>
              <Link
                href={`/${slug}/events`}
                className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-600"
                onClick={closeMobileMenu}
              >
                <CalendarDays className="h-4 w-4" />
                Veranstaltungen
              </Link>
              <Link
                href={`/${slug}/donate`}
                className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-600"
                onClick={closeMobileMenu}
              >
                <Heart className="h-4 w-4" />
                Spenden
              </Link>
            </>
          ) : (
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-600"
              onClick={closeMobileMenu}
            >
              <Home className="h-4 w-4" />
              Startseite
            </Link>
          )}

          {/* Admin-Bereich */}
          {isAdmin && (
            <div className="mt-2 border-t border-gray-100 pt-2">
              <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {isSuperAdmin ? "Plattform" : isEditor ? "Editor" : "Admin"}
              </p>
              <Link
                href={isEditor ? "/admin/posts" : "/admin"}
                className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-600"
                onClick={closeMobileMenu}
              >
                {isSuperAdmin ? <Crown className="h-4 w-4" /> : isEditor ? <Edit3 className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                {isSuperAdmin ? "Plattform-Dashboard" : isEditor ? "Editor-Bereich" : "Admin-Panel"}
              </Link>
            </div>
          )}

          {/* Lehrer-Bereich */}
          {isTeacher && (
            <div className="mt-2 border-t border-gray-100 pt-2">
              <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Lehrer
              </p>
              <Link
                href="/lehrer"
                className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                onClick={closeMobileMenu}
              >
                <GraduationCap className="h-4 w-4" />
                Meine Kurse
              </Link>
            </div>
          )}

          {/* Imam-Bereich */}
          {isImam && (
            <div className="mt-2 border-t border-gray-100 pt-2">
              <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Imam
              </p>
              <Link
                href="/imam"
                className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-violet-50 hover:text-violet-600"
                onClick={closeMobileMenu}
              >
                <Megaphone className="h-4 w-4" />
                Beiträge
              </Link>
            </div>
          )}

          {/* Konto */}
          <div className="mt-2 border-t border-gray-100 pt-2">
            {isAuthenticated ? (
              <>
                <Link
                  href="/member/profile"
                  className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  onClick={closeMobileMenu}
                >
                  <User className="h-4 w-4" />
                  Mein Profil
                </Link>
                <button
                  onClick={() => {
                    logout();
                    closeMobileMenu();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  <LogOut className="h-4 w-4" />
                  Abmelden
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  onClick={closeMobileMenu}
                >
                  <LogIn className="h-4 w-4" />
                  Anmelden
                </Link>
                <Link
                  href="/register"
                  className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-emerald-600 hover:bg-emerald-50"
                  onClick={closeMobileMenu}
                >
                  Registrieren
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
