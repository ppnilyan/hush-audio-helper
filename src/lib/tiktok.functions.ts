import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ url: z.string().url(), hdOnly: z.boolean().optional() });

type Resolved = {
  playUrl: string;
  hd: boolean;
  title: string;
  duration: number;
  views?: number;
  /** Page TikTok d'origine : nécessaire pour obtenir les cookies du CDN. */
  srcUrl?: string;
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

type TikwmResponse = {
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

// Plusieurs miroirs du service gratuit : si l'un refuse, on tente le suivant.
const ENDPOINTS: Array<(url: string) => string> = [
  (u) => `https://www.tikwm.com/api/?url=${encodeURIComponent(u)}&hd=1`,
  (u) => `https://tikwm.com/api/?url=${encodeURIComponent(u)}&hd=1`,
  (u) => `https://www.tikwm.com/api/?url=${encodeURIComponent(u)}`,
  (u) => `https://tikwm.com/api/?url=${encodeURIComponent(u)}`,
];

type TikTokItem = {
  desc?: string;
  video?: {
    duration?: number;
    playAddr?: string;
    bitrateInfo?: Array<{ PlayAddr?: { UrlList?: string[] }; Bitrate?: number }>;
  };
  stats?: { playCount?: number };
};

/** Lit directement la page TikTok et extrait le lien de lecture. */
async function resolveFromTikTokPage(url: string): Promise<Resolved | null> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const marker = 'id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const end = html.indexOf("</script>", start);
  if (end === -1) return null;
  let item: TikTokItem | undefined;
  try {
    const parsed = JSON.parse(html.slice(start + marker.length, end)) as {
      __DEFAULT_SCOPE__?: Record<string, { itemInfo?: { itemStruct?: TikTokItem } }>;
    };
    item = parsed.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
  } catch {
    return null;
  }
  const bitrates = item?.video?.bitrateInfo ?? [];
  const best = [...bitrates].sort((a, b) => (b.Bitrate ?? 0) - (a.Bitrate ?? 0))[0];
  const playUrl = best?.PlayAddr?.UrlList?.[0] ?? item?.video?.playAddr;
  if (!playUrl) return null;
  const views = item?.stats?.playCount;
  return {
    playUrl,
    srcUrl: res.url || url,
    // La page fournit la meilleure qualité disponible : on la considère HD.
    hd: true,
    title: item?.desc || "Clip TikTok",
    duration: item?.video?.duration ?? 0,
    ...(typeof views === "number" && Number.isFinite(views) ? { views } : {}),
  };

}


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

    const staleFallback = () => {
      if (cached.data?.payload) return cached.data.payload as Resolved;
      return null;
    };

    let json: TikwmResponse | null = null;
    let lastMessage = "";
    outer: for (let round = 0; round < 3; round++) {
      for (const endpoint of ENDPOINTS) {
        try {
          const res = await fetch(endpoint(data.url), {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
              Accept: "application/json",
              Referer: "https://www.tikwm.com/",
            },
          });
          if (!res.ok) {
            lastMessage = `Service indisponible (${res.status})`;
            continue;
          }
          const parsed = (await res.json()) as TikwmResponse;
          if (parsed.code === 0 && (parsed.data?.play || parsed.data?.hdplay)) {
            json = parsed;
            break outer;
          }
          lastMessage = parsed.msg || lastMessage;
        } catch {
          lastMessage = lastMessage || "Réseau indisponible";
        }
      }
      // Petite pause croissante : la plupart des refus du service gratuit sont temporaires.
      await new Promise((r) => setTimeout(r, 700 * (round + 1)));
    }

    // Repli direct sur la page TikTok : le service gratuit refuse souvent les
    // requêtes venant des serveurs (quota partagé), la page publique non.
    if (!json) {
      const direct = await resolveFromTikTokPage(data.url).catch(() => null);
      if (direct && (!hdOnly || direct.hd)) {
        memory.set(key, { at: Date.now(), value: direct });
        await supabaseAdmin
          .from("tiktok_cache")
          .upsert(
            { url_key: key, payload: direct, fetched_at: new Date().toISOString() },
            { onConflict: "url_key" },
          )
          .then(null, () => null);
        return direct;
      }
      const stale = staleFallback();
      if (stale && (!hdOnly || stale.hd)) return stale;
      throw new Error(
        /limit/i.test(lastMessage)
          ? "Le service gratuit de récupération TikTok a atteint sa limite quotidienne. Réessaie dans quelques minutes."
          : lastMessage || "Impossible de récupérer cette vidéo TikTok.",
      );
    }


    const hd = json.data?.hdplay;
    const play = hd || json.data?.play;
    if (!play) {
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
