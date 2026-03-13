"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { getPostsByMosque, deletePost } from "@/lib/actions/posts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";
import {
  postCategoryLabels,
  postCategoryColors,
  postStatusLabels,
  postStatusColors,
  visibilityLabels,
  visibilityColors,
} from "@/lib/constants";
import type { Post } from "@/types";
import { useTranslations } from "next-intl";

export default function AdminPostsPage() {
  const t = useTranslations("posts");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!mosqueId) return;

    async function load() {
      setIsLoading(true);
      const statusFilter = filter === "all" ? undefined : filter;
      const result = await getPostsByMosque(mosqueId, {
        status: statusFilter as "published" | "draft" | undefined,
        page,
      });
      if (result.success && result.data) {
        setPosts(result.data);
        setTotalPages(result.totalPages || 1);
      }
      setIsLoading(false);
    }
    load();
  }, [mosqueId, filter, page]);

  function handleFilterChange(f: "all" | "published" | "draft") {
    setFilter(f);
    setPage(1);
  }

  async function handleDelete(postId: string, title: string) {
    if (!confirm(t("deleteConfirm", { title }))) return;
    if (!user) return;

    const result = await deletePost(postId, mosqueId, user.id);
    if (result.success) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  }

  const filterLabels = {
    all: t("filterAll"),
    published: t("filterPublished"),
    draft: t("filterDraft"),
  } as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">
            {t("subtitle")}
          </p>
        </div>
        <Link
          href="/admin/posts/new"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          {t("newPost")}
        </Link>
      </div>

      {/* Filter */}
      <div className="flex gap-2" role="tablist" aria-label="Beiträge filtern">
        {(["all", "published", "draft"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => handleFilterChange(f)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              filter === f
                ? "bg-emerald-100 text-emerald-700"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Tabelle */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-0 divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-20 hidden sm:block" />
                  <Skeleton className="h-4 w-16 hidden md:block" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20 hidden lg:block" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText
                className="mb-3 h-10 w-10 text-gray-300"
                aria-hidden="true"
              />
              <p className="mb-1 text-sm font-medium text-gray-600">
                {t("noPostsYet")}
              </p>
              <p className="mb-4 text-xs text-gray-400">
                {t("noPostsHint")}
              </p>
              <Link
                href="/admin/posts/new"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                {t("newPost")}
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">{t("colTitle")}</th>
                    <th className="px-4 py-3 hidden sm:table-cell">
                      {t("colCategory")}
                    </th>
                    <th className="px-4 py-3 hidden md:table-cell">
                      {t("colVisibility")}
                    </th>
                    <th className="px-4 py-3">{t("colStatus")}</th>
                    <th className="px-4 py-3 hidden lg:table-cell">{t("colDate")}</th>
                    <th className="px-4 py-3 text-right">{t("colActions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {posts.map((post) => (
                    <tr
                      key={post.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/posts/${post.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          {post.pinned && (
                            <span
                              className="text-amber-500"
                              title={t("pinned")}
                              aria-label={t("pinned")}
                            >
                              📌
                            </span>
                          )}
                          <span className="truncate max-w-[200px] lg:max-w-[300px]">
                            {post.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            postCategoryColors[post.category] ||
                              "bg-gray-100 text-gray-600"
                          )}
                        >
                          {postCategoryLabels[post.category] || post.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            visibilityColors[post.visibility] ||
                              "bg-gray-100 text-gray-600"
                          )}
                        >
                          {visibilityLabels[post.visibility] ||
                            post.visibility}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            postStatusColors[post.status] ||
                              "bg-gray-100 text-gray-600"
                          )}
                        >
                          {postStatusLabels[post.status] || post.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                        {post.published_at
                          ? formatDate(post.published_at)
                          : formatDate(post.created)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/admin/posts/${post.id}`}
                            className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
                            title={tCommon("edit")}
                            aria-label={`Beitrag "${post.title}" bearbeiten`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(post.id, post.title); }}
                            className="rounded p-1.5 text-red-600 hover:bg-red-50"
                            title={tCommon("delete")}
                            aria-label={`Beitrag "${post.title}" löschen`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-gray-500">
                {tCommon("pageOf", { page, total: totalPages })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label={tCommon("prevPage")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label={tCommon("nextPage")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
