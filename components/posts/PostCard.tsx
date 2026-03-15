import Link from "next/link";
import Image from "next/image";
import { Pin, Calendar, User, Images } from "lucide-react";
import type { Post } from "@/types";
import { formatDate } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import {
  postCategoryColors,
  postStatusLabels,
  postStatusColors,
} from "@/lib/constants";

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || "";

interface PostCardProps {
  post: Post;
  /** Kompakte Darstellung für Admin-Listen */
  compact?: boolean;
  /** Wenn angegeben, wird die ganze Karte ein klickbarer Link */
  href?: string;
}

export async function PostCard({ post, compact, href }: PostCardProps) {
  const t = await getTranslations("postCard");
  const tL = await getTranslations("labels");
  const CAT_LABELS: Record<string, string> = {
    announcement: tL("post.category.announcement"), youth: tL("post.category.youth"),
    campaign: tL("post.category.campaign"), event: tL("post.category.event"), general: tL("post.category.general"),
  };
  const authorName = post.expand?.created_by
    ? `${post.expand.created_by.first_name} ${post.expand.created_by.last_name}`.trim() ||
      post.expand.created_by.full_name
    : "";

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
        {post.pinned && <Pin className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{post.title}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${postCategoryColors[post.category]}`}
            >
              {CAT_LABELS[post.category] || post.category}
            </span>
            {post.published_at && (
              <time dateTime={new Date(post.published_at).toISOString()}>
                {formatDate(post.published_at)}
              </time>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${postStatusColors[post.status]}`}
        >
          {postStatusLabels[post.status]}
        </span>
      </div>
    );
  }

  const firstImage = post.attachments?.[0];
  const extraImageCount = (post.attachments?.length || 0) - 1;

  const card = (
    <article aria-label={post.title} className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md${href ? " cursor-pointer" : ""}`}>
      {/* Cover-Bild */}
      {firstImage && (
        <div className="relative mx-auto aspect-square w-1/2 overflow-hidden rounded-lg bg-gray-100">
          <Image
            src={`${PB_URL}/api/files/posts/${post.id}/${firstImage}`}
            alt={post.title}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 50vw, 300px"
          />
          {extraImageCount > 0 && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
              <Images className="h-3 w-3" />
              +{extraImageCount}
            </div>
          )}
        </div>
      )}
      <div className="p-5">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${postCategoryColors[post.category]}`}
            >
              {CAT_LABELS[post.category] || post.category}
            </span>
            {post.pinned && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                <Pin className="h-3 w-3" aria-hidden="true" />
                {t("pinned")}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="mb-2 text-lg font-bold text-gray-900">{post.title}</h3>

        {/* Content */}
        <p className="line-clamp-4 text-sm leading-relaxed text-gray-600">
          {post.content}
        </p>

        {/* Footer */}
        <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
          {authorName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" aria-hidden="true" />
              {authorName}
            </span>
          )}
          {post.published_at && (
            <time dateTime={new Date(post.published_at).toISOString()} className="flex items-center gap-1">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {formatDate(post.published_at)}
            </time>
          )}
        </div>
      </div>
    </article>
  );

  if (href) {
    return (
      <Link href={href} className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded-xl">
        {card}
      </Link>
    );
  }

  return card;
}
