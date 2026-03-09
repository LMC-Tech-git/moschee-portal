"use client";

import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { createPost } from "@/lib/actions/posts";
import { getPortalSettings } from "@/lib/actions/settings";
import { PostForm } from "@/components/posts/PostForm";

export default function ImamNewPostPage() {
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const [defaultVisibility, setDefaultVisibility] = useState<string>("public");

  useEffect(() => {
    if (!mosqueId) return;
    getPortalSettings(mosqueId).then((r) => {
      if (r.success && r.settings) {
        setDefaultVisibility(r.settings.default_post_visibility || "public");
      }
    });
  }, [mosqueId]);

  async function handleCreate(formData: FormData) {
    if (!user) return { success: false, error: "Nicht eingeloggt" };
    return createPost(mosqueId, user.id, formData);
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/imam/posts"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück zu Beiträge
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Neuer Beitrag</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <PostForm onSubmit={handleCreate} backPath="/imam/posts" defaultVisibility={defaultVisibility} />
      </div>
    </div>
  );
}
