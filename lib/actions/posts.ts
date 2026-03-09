"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { postSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import type { Post } from "@/types";
import type { RecordModel } from "pocketbase";

// --- Helpers ---

function mapRecordToPost(record: RecordModel): Post {
  return {
    id: record.id,
    mosque_id: record.mosque_id || "",
    title: record.title || "",
    content: record.content || "",
    category: record.category || "general",
    visibility: record.visibility || "public",
    pinned: record.pinned ?? false,
    status: record.status || "draft",
    published_at: record.published_at || "",
    attachments: record.attachments || [],
    created_by: record.created_by || "",
    created: record.created || "",
    updated: record.updated || "",
    expand: record.expand
      ? {
          created_by: record.expand.created_by
            ? {
                id: record.expand.created_by.id,
                mosque_id: record.expand.created_by.mosque_id || "",
                email: record.expand.created_by.email || "",
                first_name: record.expand.created_by.first_name || "",
                last_name: record.expand.created_by.last_name || "",
                full_name: record.expand.created_by.full_name || "",
                phone: record.expand.created_by.phone || "",
                member_no: record.expand.created_by.member_no || "",
                membership_number:
                  record.expand.created_by.membership_number || "",
                status: record.expand.created_by.status || "pending",
                role: record.expand.created_by.role || "member",
                created: record.expand.created_by.created || "",
                updated: record.expand.created_by.updated || "",
              }
            : undefined,
        }
      : undefined,
  };
}

// --- Server Actions ---

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Alle Posts einer Moschee laden (Admin).
 * mosque_id kommt vom Auth-User, NICHT vom Client.
 */
export async function getPostsByMosque(
  mosqueId: string,
  options?: { status?: "published" | "draft"; limit?: number; page?: number }
): Promise<ActionResult<Post[]> & { totalPages?: number; page?: number }> {
  try {
    const pb = await getAdminPB();
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    let filter = `mosque_id = "${mosqueId}"`;
    if (options?.status) {
      filter += ` && status = "${options.status}"`;
    }

    const records = await pb.collection("posts").getList(page, limit, {
      filter,
      sort: "-pinned,-created",
      expand: "created_by",
    });

    return {
      success: true,
      data: records.items.map(mapRecordToPost),
      totalPages: records.totalPages,
      page: records.page,
    };
  } catch (error) {
    console.error("[Posts] Fehler beim Laden:", error);
    return { success: false, error: "Beiträge konnten nicht geladen werden" };
  }
}

/**
 * Öffentliche Posts einer Moschee laden (für Live Dashboard).
 */
export async function getPublicPostsByMosque(
  mosqueId: string,
  limit = 20
): Promise<ActionResult<Post[]>> {
  try {
    const pb = await getAdminPB();

    const records = await pb.collection("posts").getList(1, limit, {
      filter: `mosque_id = "${mosqueId}" && status = "published" && visibility = "public"`,
      sort: "-pinned,-published_at",
      expand: "created_by",
    });

    return {
      success: true,
      data: records.items.map(mapRecordToPost),
    };
  } catch (error) {
    console.error("[Posts] Fehler beim Laden öffentlicher Posts:", error);
    return { success: false, error: "Beiträge konnten nicht geladen werden" };
  }
}

/**
 * Posts für eingeloggte Mitglieder (public + members).
 */
export async function getMemberPostsByMosque(
  mosqueId: string,
  limit = 20
): Promise<ActionResult<Post[]>> {
  try {
    const pb = await getAdminPB();

    const records = await pb.collection("posts").getList(1, limit, {
      filter: `mosque_id = "${mosqueId}" && status = "published"`,
      sort: "-pinned,-published_at",
      expand: "created_by",
    });

    return {
      success: true,
      data: records.items.map(mapRecordToPost),
    };
  } catch (error) {
    console.error("[Posts] Fehler beim Laden (Member):", error);
    return { success: false, error: "Beiträge konnten nicht geladen werden" };
  }
}

/**
 * Öffentliche Posts gefiltert + paginiert (für /[slug]/posts).
 */
export async function getPublicPostsFiltered(
  mosqueId: string,
  options?: { category?: string; page?: number; limit?: number }
): Promise<ActionResult<Post[]> & { totalPages?: number; page?: number; total?: number }> {
  try {
    const pb = await getAdminPB();
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    let filter = `mosque_id = "${mosqueId}" && status = "published" && visibility = "public"`;
    if (options?.category) {
      filter += ` && category = "${options.category}"`;
    }

    const records = await pb.collection("posts").getList(page, limit, {
      filter,
      sort: "-pinned,-published_at",
      expand: "created_by",
    });

    return {
      success: true,
      data: records.items.map(mapRecordToPost),
      totalPages: records.totalPages,
      page: records.page,
      total: records.totalItems,
    };
  } catch (error) {
    console.error("[Posts] Fehler beim Laden (gefiltert):", error);
    return { success: false, error: "Beiträge konnten nicht geladen werden" };
  }
}

/**
 * Posts für Mitglieder gefiltert + paginiert (public + members).
 */
export async function getMemberPostsFiltered(
  mosqueId: string,
  options?: { category?: string; page?: number; limit?: number }
): Promise<ActionResult<Post[]> & { totalPages?: number; page?: number; total?: number }> {
  try {
    const pb = await getAdminPB();
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    let filter = `mosque_id = "${mosqueId}" && status = "published"`;
    if (options?.category) {
      filter += ` && category = "${options.category}"`;
    }

    const records = await pb.collection("posts").getList(page, limit, {
      filter,
      sort: "-pinned,-published_at",
      expand: "created_by",
    });

    return {
      success: true,
      data: records.items.map(mapRecordToPost),
      totalPages: records.totalPages,
      page: records.page,
      total: records.totalItems,
    };
  } catch (error) {
    console.error("[Posts] Fehler beim Laden (Member gefiltert):", error);
    return { success: false, error: "Beiträge konnten nicht geladen werden" };
  }
}

/**
 * Einzelnen Post laden.
 */
export async function getPostById(
  postId: string,
  mosqueId: string
): Promise<ActionResult<Post>> {
  try {
    const pb = await getAdminPB();
    const record = await pb.collection("posts").getOne(postId, {
      expand: "created_by",
    });

    // Sicherheitsprüfung: Post gehört zur Moschee
    if (record.mosque_id !== mosqueId) {
      return { success: false, error: "Post nicht gefunden" };
    }

    return { success: true, data: mapRecordToPost(record) };
  } catch (error) {
    console.error("[Posts] Fehler beim Laden:", error);
    return { success: false, error: "Beitrag konnte nicht geladen werden" };
  }
}

/**
 * Neuen Post erstellen.
 * Akzeptiert FormData (unterstützt Datei-Uploads für Bilder).
 */
export async function createPost(
  mosqueId: string,
  userId: string,
  formData: FormData
): Promise<ActionResult<Post>> {
  try {
    const validated = postSchema.parse({
      title: (formData.get("title") as string) || "",
      content: (formData.get("content") as string) || "",
      category: (formData.get("category") as string) || "general",
      visibility: (formData.get("visibility") as string) || "public",
      pinned: formData.get("pinned") === "true",
      status: (formData.get("status") as string) || "draft",
    });

    const pb = await getAdminPB();

    const pbFormData = new FormData();
    pbFormData.append("title", validated.title);
    pbFormData.append("content", validated.content);
    pbFormData.append("category", validated.category);
    pbFormData.append("visibility", validated.visibility);
    pbFormData.append("pinned", String(validated.pinned));
    pbFormData.append("status", validated.status);
    pbFormData.append("mosque_id", mosqueId);
    pbFormData.append("created_by", userId);
    if (validated.status === "published") {
      pbFormData.append("published_at", new Date().toISOString());
    }

    const images = formData.getAll("images");
    images.forEach((item) => {
      if (item && typeof item !== "string" && "size" in (item as object) && (item as File).size > 0) {
        pbFormData.append("attachments", item as Blob, (item as File).name || "image");
      }
    });

    const record = await pb.collection("posts").create(pbFormData);

    await logAudit({
      mosqueId,
      userId,
      action: "post.created",
      entityType: "post",
      entityId: record.id,
      details: { title: validated.title, status: validated.status },
    });

    return { success: true, data: mapRecordToPost(record) };
  } catch (error) {
    console.error("[Posts] Fehler beim Erstellen:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return { success: false, error: "Ungültige Eingabedaten" };
    }
    return { success: false, error: "Beitrag konnte nicht erstellt werden" };
  }
}

/**
 * Post aktualisieren.
 * Akzeptiert FormData (unterstützt Datei-Uploads und Löschung von Bildern).
 */
export async function updatePost(
  postId: string,
  mosqueId: string,
  userId: string,
  formData: FormData
): Promise<ActionResult<Post>> {
  try {
    const validated = postSchema.parse({
      title: (formData.get("title") as string) || "",
      content: (formData.get("content") as string) || "",
      category: (formData.get("category") as string) || "general",
      visibility: (formData.get("visibility") as string) || "public",
      pinned: formData.get("pinned") === "true",
      status: (formData.get("status") as string) || "draft",
    });

    const pb = await getAdminPB();

    // Prüfen, dass der Post zur Moschee gehört
    const existing = await pb.collection("posts").getOne(postId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Post nicht gefunden" };
    }

    const pbFormData = new FormData();
    pbFormData.append("title", validated.title);
    pbFormData.append("content", validated.content);
    pbFormData.append("category", validated.category);
    pbFormData.append("visibility", validated.visibility);
    pbFormData.append("pinned", String(validated.pinned));
    pbFormData.append("status", validated.status);

    // published_at setzen, wenn erstmals veröffentlicht
    if (validated.status === "published" && !existing.published_at) {
      pbFormData.append("published_at", new Date().toISOString());
    }

    // Neue Bilder anhängen
    const images = formData.getAll("images");
    images.forEach((item) => {
      if (item && typeof item !== "string" && "size" in (item as object) && (item as File).size > 0) {
        pbFormData.append("attachments", item as Blob, (item as File).name || "image");
      }
    });

    // Bestehende Bilder löschen (PocketBase: "attachments-" = Dateinamen zum Löschen)
    const removedImages = formData.getAll("removedImages") as string[];
    removedImages.forEach((filename) => {
      if (filename) pbFormData.append("attachments-", filename);
    });

    const record = await pb.collection("posts").update(postId, pbFormData);

    await logAudit({
      mosqueId,
      userId,
      action: "post.updated",
      entityType: "post",
      entityId: postId,
      details: { title: validated.title, status: validated.status },
    });

    return { success: true, data: mapRecordToPost(record) };
  } catch (error) {
    console.error("[Posts] Fehler beim Aktualisieren:", error);
    return {
      success: false,
      error: "Beitrag konnte nicht aktualisiert werden",
    };
  }
}

/**
 * Post löschen.
 */
export async function deletePost(
  postId: string,
  mosqueId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    // Prüfen, dass der Post zur Moschee gehört
    const existing = await pb.collection("posts").getOne(postId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Post nicht gefunden" };
    }

    await pb.collection("posts").delete(postId);

    await logAudit({
      mosqueId,
      userId,
      action: "post.deleted",
      entityType: "post",
      entityId: postId,
      details: { title: existing.title },
    });

    return { success: true };
  } catch (error) {
    console.error("[Posts] Fehler beim Löschen:", error);
    return { success: false, error: "Beitrag konnte nicht gelöscht werden" };
  }
}
