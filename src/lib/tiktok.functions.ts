import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ url: z.string().url(), hdOnly: z.boolean().optional() });

type Resolved = {
  playUrl: string;
  hd: boolean;
  title: string;
  duration: number;
  views?: number;
};

// Les liens de lecture renvoyés par le fournisseur expirent : on garde le cache court.
const TTL_MS = 2 * 60 * 60 * 1000;

/** Normalise l'URL pour que deux liens équivalents partagent la même entrée de cache. */
function cacheKey(url: string, hdOnly: boolean) {
  let normalized = url.trim();
  try {
    const u = new URL(normalized);
    u.hash = "";
    u.search = "";
    normalized = `${u.origin}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    normalized = normalized.toLowerCase();
  }
  return `${normalized}|${hdOnly ? "hd" : "any"}`;
}

// Cache mémoire (même isolate) devant le cache base de données.
const memory = new Map<string, { at: number; value: Resolved }>();

export const resolveTikTok = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const hdOnly = !!data.hdOnly;
    const key = cacheKey(data.url, hdOnly);

    const hot = memory.get(key);
    if (hot && Date.now() - hot.at < TTL_MS) return hot.value;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cached = await supabaseAdmin
      .from("tiktok_cache")
      .select("payload, fetched_at")
      .eq("url_key", key)
      .maybeSingle();
    if (cached.data?.payload && cached.data.fetched_at) {
      const age = Date.now() - new Date(cached.data.fetched_at).getTime();
      if (age < TTL_MS) {
        const value = cached.data.payload as Resolved;
        memory.set(key, { at: Date.now() - age, value });
        return value;
      }
    }

    const res = await fetch(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(data.url)}&hd=1`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    );
    if (!res.ok) {
      throw new Error(`Service de téléchargement indisponible (${res.status})`);
    }
    const json = (await res.json()) as {
      code?: number;
      msg?: string;
      data?: {
        play?: string;
        hdplay?: string;
        title?: string;
        duration?: number;
        play_count?: number | string;
      };
    };
    const hd = json.data?.hdplay;
    const play = hd || json.data?.play;
    if (json.code !== 0 || !play) {
      throw new Error(json.msg || "Impossible de récupérer cette vidéo TikTok.");
    }
    if (hdOnly && !hd) {
      throw new Error("Aucune version HD n'est disponible pour cette vidéo.");
    }
    const chosen = hdOnly ? hd! : play;
    const absolute = chosen.startsWith("http") ? chosen : `https://www.tikwm.com${chosen}`;
    const rawViews = Number(json.data?.play_count);
    const result: Resolved = {
      playUrl: absolute,
      hd: !!hd,
      title: json.data?.title ?? "Clip TikTok",
      duration: json.data?.duration ?? 0,
      ...(Number.isFinite(rawViews) ? { views: rawViews } : {}),
    };

    memory.set(key, { at: Date.now(), value: result });
    await supabaseAdmin
      .from("tiktok_cache")
      .upsert(
        { url_key: key, payload: result, fetched_at: new Date().toISOString() },
        { onConflict: "url_key" },
      )
      .then(null, () => null);

    return result;
  });
