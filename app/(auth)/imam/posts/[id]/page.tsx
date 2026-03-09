"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { getPostById, updatePost } from "@/lib/actions/posts";
import { PostForm } from "@/components/posts/PostForm";
import type { Post } from "@/types";

export default function ImamEditPostPage() {
  const params = useParams();
  const postId = params.id as string;
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!mosqueId || !postId) return;

    async function load() {
      const result = await getPostById(postId, mosqueId);
      if (result.success && result.data) {
        setPost(result.data);
      } else {
        setError(result.error || "Beitrag nicht gefunden");
      }
      setIsLoading(false);
    }
    load();
  }, [mosqueId, postId]);

  async function handleUpdate(formData: FormData) {
    if (!user) return { success: false, error: "Nicht eingeloggt" };
    return updatePost(postId, mosqueId, user.id, formData);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error || "Beitrag nicht gefunden"}</p>
        <Link
          href="/imam/posts"
          className="mt-3 inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück zu Beiträge
        </Link>
      </div>
    );
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
        <h1 className="text-2xl font-bold text-gray-900">Beitrag bearbeiten</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <PostForm initialData={post} onSubmit={handleUpdate} isEdit backPath="/imam/posts" />
      </div>
    </div>
  );
}
