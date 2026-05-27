"use client";

import type { TVColors, TVPostItem } from "@/types";
import { useTVLocale } from "../LocaleAwareText";
import { tvT } from "../tv-i18n";

export function PostsSlide({ data, colors }: { data: TVPostItem[]; colors: TVColors }) {
  const { mode, currentLocale, secondary } = useTVLocale();
  const t = tvT(currentLocale);
  const tSec = mode === "bilingual" && secondary !== "none" ? tvT(secondary) : null;
  const post = data[0];
  if (!post) return null;

  return (
    <div className="flex h-full w-full flex-col gap-[3vh] px-[6vw] py-[4vh]">
      <h2 className="text-[4vh] font-semibold opacity-70" style={{ color: colors.accent }}>
        {mode === "bilingual" && tSec ? `${t.latestPost} · ${tSec.latestPost}` : t.latestPost}
      </h2>

      <div className="flex flex-1 flex-col gap-[3vh] md:flex-row">
        {post.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.imageUrl}
            alt=""
            className="h-[40vh] w-full rounded-2xl object-cover md:w-[40vw]"
          />
        )}
        <div className="flex flex-1 flex-col justify-center gap-[2vh]" style={{ color: colors.text }}>
          <h3 className="text-[6vh] font-bold leading-tight">{post.title}</h3>
          {post.excerpt && <p className="text-[3vh] opacity-80">{post.excerpt}</p>}
        </div>
      </div>
    </div>
  );
}
