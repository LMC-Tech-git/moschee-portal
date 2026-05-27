"use client";

import type { TVColors, TVPostItem } from "@/types";
import { useTVLocale } from "../LocaleAwareText";
import { tvT } from "../tv-i18n";

export function PostsSlide({ data, colors: _colors }: { data: TVPostItem[]; colors: TVColors }) {
  const { mode, currentLocale, secondary } = useTVLocale();
  const t = tvT(currentLocale);
  const tSec = mode === "bilingual" && secondary !== "none" ? tvT(secondary) : null;
  const post = data[0];
  if (!post) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4vh",
        width: "100%",
        maxWidth: "92vw",
      }}
    >
      <div className="tv-eyebrow">
        {mode === "bilingual" && tSec ? `${t.latestPost} · ${tSec.latestPost}` : t.latestPost}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: post.imageUrl ? "minmax(0,1fr) minmax(0,1fr)" : "1fr",
          gap: "4vw",
          alignItems: "center",
        }}
      >
        {post.imageUrl && (
          <div
            style={{
              borderRadius: "2.5vh",
              overflow: "hidden",
              aspectRatio: "16/10",
              boxShadow: "0 4vh 10vh -2vh rgba(0,0,0,0.5)",
              border: "1px solid var(--hairline-x)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt=""
              className="tv-kenburns"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "2vh" }}>
          <h3
            className="tv-headline"
            style={{ fontSize: "var(--t-xl)" }}
          >
            {post.title}
          </h3>
          {post.excerpt && (
            <p
              style={{
                fontSize: "var(--t-base)",
                color: "var(--text-dim)",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {post.excerpt}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
