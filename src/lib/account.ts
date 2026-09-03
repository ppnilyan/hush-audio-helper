import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { normalizeSettings, type MontageSettings } from "@/lib/settings";

/** Session Supabase courante (null = déconnecté, undefined = en cours de chargement). */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (alive) setSession(s);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return session;
}

/* ---------------- Réglages automatiques ---------------- */

export async function loadSettings(userId: string): Promise<MontageSettings | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeSettings(data.settings);
}

export async function saveSettings(userId: string, settings: MontageSettings) {
  await supabase
    .from("user_settings")
    .upsert({ user_id: userId, settings }, { onConflict: "user_id" });
}

/* ---------------- Presets ---------------- */

export type Preset = { id: string; name: string; settings: MontageSettings };

export async function listPresets(userId: string): Promise<Preset[]> {
  const { data, error } = await supabase
    .from("montage_presets")
    .select("id, name, settings")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    settings: normalizeSettings(p.settings),
  }));
}

export async function upsertPreset(userId: string, name: string, settings: MontageSettings) {
  const { error } = await supabase
    .from("montage_presets")
    .upsert({ user_id: userId, name, settings }, { onConflict: "user_id,name" });
  if (error) throw error;
}

export async function deletePreset(id: string) {
  const { error } = await supabase.from("montage_presets").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- Historique lié au compte ---------------- */

export type CloudMontage = {
  id: string;
  url: string;
  createdAt: number;
  expiresAt: number;
  duration: number;
  ext: string;
  storagePath: string;
};

const RETENTION_MS = 5 * 60 * 60 * 1000;

export async function uploadMontage(
  userId: string,
  blob: Blob,
  meta: { duration: number; mime: string; ext: string },
) {
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${meta.ext}`;
  const up = await supabase.storage
    .from("montages")
    .upload(path, blob, { contentType: meta.mime, upsert: false });
  if (up.error) throw up.error;
  const { error } = await supabase.from("montage_history").insert({
    user_id: userId,
    storage_path: path,
    duration: meta.duration,
    mime: meta.mime,
    ext: meta.ext,
    size_bytes: blob.size,
    expires_at: new Date(Date.now() + RETENTION_MS).toISOString(),
  });
  if (error) throw error;
}

export async function listMontages(userId: string): Promise<CloudMontage[]> {
  const now = new Date().toISOString();
  const { data: expired } = await supabase
    .from("montage_history")
    .select("id, storage_path")
    .eq("user_id", userId)
    .lt("expires_at", now);
  if (expired && expired.length > 0) {
    await supabase.storage.from("montages").remove(expired.map((e) => e.storage_path));
    await supabase
      .from("montage_history")
      .delete()
      .in("id", expired.map((e) => e.id));
  }

  const { data, error } = await supabase
    .from("montage_history")
    .select("id, storage_path, duration, ext, created_at, expires_at")
    .eq("user_id", userId)
    .gte("expires_at", now)
    .order("created_at", { ascending: false });
  if (error || !data || data.length === 0) return [];

  const signed = await supabase.storage
    .from("montages")
    .createSignedUrls(data.map((d) => d.storage_path), 60 * 60 * 5);

  const urlByPath = new Map<string, string>();
  for (const s of signed.data ?? []) {
    if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  }

  return data
    .filter((d) => urlByPath.has(d.storage_path))
    .map((d) => ({
      id: d.id,
      url: urlByPath.get(d.storage_path)!,
      createdAt: new Date(d.created_at).getTime(),
      expiresAt: new Date(d.expires_at).getTime(),
      duration: d.duration,
      ext: d.ext,
      storagePath: d.storage_path,
    }));
}

export async function deleteMontage(entry: { id: string; storagePath: string }) {
  await supabase.storage.from("montages").remove([entry.storagePath]);
  await supabase.from("montage_history").delete().eq("id", entry.id);
}
