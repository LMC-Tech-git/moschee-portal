import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { resolveMosqueWithSettings } from "@/lib/resolve-mosque";
import {
  getPublicPostsFiltered,
  getMemberPostsFiltered,
} from "@/lib/actions/posts";
import { PostCard } from "@/components/posts/PostCard";
import { postCategoryLabels } from "@/lib/constants";
import type { Post } from "@/types";

const POSTS_PER_PAGE = 20;

const CATEGORIES: { value: Post["category"] | ""; label: string }[] = [
  { value: "",             label: "Alle"          },
  { value: "announcement", label: "Ankündigungen" },
  { value: "general",      label: "Allgemein"     },
  { value: "event",        label: "Veranstaltung" },
  { value: "campaign",     label: "Kampagne"      },
  { value: "youth",        label: "Jugend"        },
];

export default async function PostsPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { category?: string; page?: string };
}) {
  const result = await resolveMosqueWithSettings(params.slug);
  if (!result) notFound();
  const { mosque } = result;

  const cookieStore = cookies();
  const isLoggedIn = !!cookieStore.get("pb_auth")?.value;

  const category = searchParams.category || "";
  const parsedPage = parseInt(searchParams.page || "1", 10);
  const page = Math.max(1, isNaN(parsedPage) ? 1 : parsedPage);

  const postsResult = isLoggedIn
    ? await getMemberPostsFiltered(mosque.id, {
        category: category || undefined,
        page,
        limit: POSTS_PER_PAGE,
      })
    : await getPublicPostsFiltered(mosque.id, {
        category: category || undefined,
        page,
        limit: POSTS_PER_PAGE,
      });

  const posts = postsResult.success ? postsResult.data || [] : [];
  const totalPages = postsResult.totalPages || 1;

  function pageHref(newPage: number) {
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (newPage > 1) p.set("page", String(newPage));
    const qs = p.toString();
    return `/${params.slug}/posts${qs ? `?${qs}` : ""}`;
  }

  function categoryHref(cat: string) {
    const p = new URLSearchParams();
    if (cat) p.set("category", cat);
    const qs = p.toString();
    return `/${params.slug}/posts${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      {/* Header */}
      <section
        className="py-10"
        style={{
          background:
            "linear-gradient(to bottom right, var(--brand-primary, #059669), color-mix(in srgb, var(--brand-primary, #059669) 80%, transparent))",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href={`/${params.slug}`}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Zurück zur Startseite"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
                Beiträge
              </h1>
              <p className="mt-1 text-sm text-white/70">{mosque.name}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Kategorie-Filter */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav
            aria-label="Kategorie-Filter"
            className="flex gap-1 overflow-x-auto py-3 scrollbar-none"
          >
            {CATEGORIES.map((cat) => {
              const isActive = category === cat.value;
              return (
                <Link
                  key={cat.value}
                  href={categoryHref(cat.value)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Beiträge */}
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {posts.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
              <FileText
                className="mx-auto mb-3 h-10 w-10 text-gray-300"
                aria-hidden="true"
              />
              <p className="font-medium text-gray-500">
                Keine Beiträge{" "}
                {category
                  ? `in der Kategorie „${postCategoryLabels[category as Post["category"]]}"`
                  : "vorhanden"}
                .
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  href={`/${params.slug}/posts/${post.id}`}
                />
              ))}
            </div>
          )}

          {/* Paginierung */}
          {totalPages > 1 && (
            <nav
              aria-label="Seiten-Navigation"
              className="mt-8 flex items-center justify-center gap-2"
            >
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                  aria-label="Vorherige Seite"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-100 text-gray-300 cursor-not-allowed">
                  <ChevronLeft className="h-4 w-4" />
                </span>
              )}

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                if (
                  p === 1 ||
                  p === totalPages ||
                  (p >= page - 1 && p <= page + 1)
                ) {
                  return (
                    <Link
                      key={p}
                      href={pageHref(p)}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                        p === page
                          ? "bg-emerald-600 text-white"
                          : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                      aria-current={p === page ? "page" : undefined}
                    >
                      {p}
                    </Link>
                  );
                }
                if (p === page - 2 || p === page + 2) {
                  return (
                    <span key={p} className="px-1 text-gray-400">
                      …
                    </span>
                  );
                }
                return null;
              })}

              {page < totalPages ? (
                <Link
                  href={pageHref(page + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                  aria-label="Nächste Seite"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-100 text-gray-300 cursor-not-allowed">
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </nav>
          )}
        </div>
      </section>
    </>
  );
}
