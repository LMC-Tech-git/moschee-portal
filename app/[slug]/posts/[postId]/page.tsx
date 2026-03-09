import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { ChevronLeft, Calendar, User, Pin } from "lucide-react";
import { resolveMosqueBySlug } from "@/lib/resolve-mosque";
import { getPostById } from "@/lib/actions/posts";
import { formatDate } from "@/lib/utils";
import { postCategoryLabels, postCategoryColors } from "@/lib/constants";

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || "";

export default async function PostDetailPage({
  params,
}: {
  params: { slug: string; postId: string };
}) {
  const mosque = await resolveMosqueBySlug(params.slug);
  if (!mosque) notFound();

  const cookieStore = cookies();
  const isLoggedIn = !!cookieStore.get("pb_auth")?.value;

  const result = await getPostById(params.postId, mosque.id);
  if (!result.success || !result.data) notFound();

  const post = result.data;

  // Gäste dürfen keine members-only Posts sehen
  if (post.visibility === "members" && !isLoggedIn) notFound();

  const authorName = post.expand?.created_by
    ? `${post.expand.created_by.first_name} ${post.expand.created_by.last_name}`.trim() ||
      post.expand.created_by.full_name
    : "";

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
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Link
            href={`/${params.slug}/posts`}
            className="mb-4 inline-flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Alle Beiträge
          </Link>

          {/* Kategorie + Pinned */}
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${postCategoryColors[post.category]}`}
            >
              {postCategoryLabels[post.category]}
            </span>
            {post.pinned && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-300">
                <Pin className="h-3 w-3" />
                Angepinnt
              </span>
            )}
          </div>

          <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-white/70">
            {authorName && (
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {authorName}
              </span>
            )}
            {post.published_at && (
              <time
                dateTime={new Date(post.published_at).toISOString()}
                className="flex items-center gap-1"
              >
                <Calendar className="h-4 w-4" />
                {formatDate(post.published_at)}
              </time>
            )}
          </div>
        </div>
      </section>

      {/* Inhalt */}
      <section className="py-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Bilder-Galerie */}
          {post.attachments && post.attachments.length > 0 && (
            <div
              className={`mb-8 grid gap-3 ${
                post.attachments.length === 1
                  ? "grid-cols-1"
                  : post.attachments.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-2 sm:grid-cols-3"
              }`}
            >
              {post.attachments.map((filename, idx) => (
                <a
                  key={filename}
                  href={`${PB_URL}/api/files/posts/${post.id}/${filename}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative overflow-hidden rounded-xl bg-gray-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${PB_URL}/api/files/posts/${post.id}/${filename}`}
                    alt={`Bild ${idx + 1} – ${post.title}`}
                    className="w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    style={{ aspectRatio: "4/3" }}
                  />
                </a>
              ))}
            </div>
          )}

          {/* Text */}
          <div className="whitespace-pre-wrap text-gray-800 leading-relaxed text-base">
            {post.content}
          </div>
        </div>
      </section>
    </>
  );
}
