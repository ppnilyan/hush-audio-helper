import { supabase } from "@/integrations/supabase/client";

export type GuideCategory = "tutorial" | "showcase";

export type GuideVideo = {
  id: string;
  category: GuideCategory;
  title: string;
  description: string | null;
  storagePath: string;
  url: string;
  createdAt: string;
};

const BUCKET = "guide-videos";

/** Vrai si le compte connecté est administrateur. */
export async function isAdminAccount(): Promise<boolean> {
  const { data } = await supabase.from("user_roles").select("role").eq("role", "admin").limit(1);
  return Boolean(data && data.length > 0);
}

/** Toutes les vidéos du guide, avec des liens de lecture temporaires. */
export async function listGuideVideos(): Promise<GuideVideo[]> {
  const { data, error } = await supabase
    .from("guide_videos")
    .select("id, category, title, description, storage_path, created_at")
    .order("created_at", { ascending: false });
  if (error || !data || data.length === 0) return [];

  const signed = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(
      data.map((d) => d.storage_path),
      60 * 60 * 6,
    );
  const urlByPath = new Map<string, string>();
  for (const s of signed.data ?? []) {
    if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  }

  return data
    .filter((d) => urlByPath.has(d.storage_path))
    .map((d) => ({
      id: d.id,
      category: (d.category === "showcase" ? "showcase" : "tutorial") as GuideCategory,
      title: d.title,
      description: d.description,
      storagePath: d.storage_path,
      url: urlByPath.get(d.storage_path)!,
      createdAt: d.created_at,
    }));
}

/** Dépose une vidéo (réservé à l'administrateur par les règles de sécurité). */
export async function uploadGuideVideo(input: {
  file: File;
  title: string;
  description: string;
  category: GuideCategory;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");

  const ext = input.file.name.split(".").pop()?.toLowerCase() || "mp4";
  const path = `${input.category}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage
    .from(BUCKET)
    .upload(path, input.file, { contentType: input.file.type || "video/mp4", upsert: false });
  if (up.error) throw up.error;

  const { error } = await supabase.from("guide_videos").insert({
    category: input.category,
    title: input.title.trim() || input.file.name,
    description: input.description.trim() || null,
    storage_path: path,
    created_by: uid,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

/** Supprime une vidéo et son fichier. */
export async function deleteGuideVideo(video: { id: string; storagePath: string }) {
  await supabase.storage.from(BUCKET).remove([video.storagePath]);
  const { error } = await supabase.from("guide_videos").delete().eq("id", video.id);
  if (error) throw error;
}

/**
 * Lit l'en-tête du fichier pour repérer les formats que les iPhone ne lisent pas (AV1).
 */
export async function detectUnsupportedCodec(file: File): Promise<"av1" | null> {
  try {
    const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
    const text = new TextDecoder("latin1").decode(head);
    if (text.includes("av01")) return "av1";
    return null;
  } catch {
    return null;
  }
}
