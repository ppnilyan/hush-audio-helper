import { createFileRoute } from "@tanstack/react-router";

const ALLOWED = [
  "tikwm.com",
  "tiktok.com",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokcdn-eu.com",
  "tiktokv.com",
  "byteoversea.com",
  "ttwstatic.com",
];
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Le CDN TikTok n'accepte le lien de lecture qu'avec les cookies de la même
// visite de page : on relit la page et on garde le couple lien + cookies.
const sessionCache = new Map<string, { at: number; playUrl: string; cookie: string }>();
const SESSION_TTL_MS = 10 * 60 * 1000;

type TikTokItem = {
  video?: { playAddr?: string; bitrateInfo?: Array<{ PlayAddr?: { UrlList?: string[] }; Bitrate?: number }> };
};

function isTikTokPage(value: string): URL | null {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return u;
    return null;
  } catch {
    return null;
  }
}

async function tiktokSession(pageUrl: URL) {
  const key = pageUrl.toString();
  const hot = sessionCache.get(key);
  if (hot && Date.now() - hot.at < SESSION_TTL_MS) return hot;

  const res = await fetch(key, {
    redirect: "follow",
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!res.ok) return null;
  const cookie = (res.headers.get("set-cookie") ?? "")
    .split(/,(?=[^;]+?=)/)
    .map((c) => c.split(";")[0]!.trim())
    .filter(Boolean)
    .join("; ");
  const html = await res.text();
  const marker = 'id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">';
  const start = html.indexOf(marker);
  const end = start === -1 ? -1 : html.indexOf("</script>", start);
  if (start === -1 || end === -1) return null;
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
  const entry = { at: Date.now(), playUrl, cookie };
  sessionCache.set(key, entry);
  return entry;
}


export const Route = createFileRoute("/api/public/media-proxy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const target = params.get("url");
        if (!target) return new Response("Missing url", { status: 400 });

        let parsed: URL;
        try {
          parsed = new URL(target);
        } catch {
          return new Response("Invalid url", { status: 400 });
        }
        if (parsed.protocol !== "https:") return new Response("Invalid protocol", { status: 400 });
        if (!ALLOWED.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) {
          return new Response("Host not allowed", { status: 403 });
        }

        const fromTikwm = parsed.hostname.endsWith("tikwm.com");
        const src = params.get("src");
        const srcPage = !fromTikwm && src ? isTikTokPage(src) : null;
        const cookie = srcPage ? await tiktokCookieFor(srcPage).catch(() => "") : "";
        const upstream = await fetch(parsed.toString(), {
          headers: {
            "User-Agent": fromTikwm ? "Mozilla/5.0" : UA,
            Referer: fromTikwm ? "https://www.tikwm.com/" : "https://www.tiktok.com/",
            ...(fromTikwm ? {} : { Origin: "https://www.tiktok.com" }),
            ...(cookie ? { Cookie: cookie } : {}),
            ...(request.headers.get("range") ? { Range: request.headers.get("range")! } : {}),
          },
        });


        if (!upstream.ok || !upstream.body) {
          return new Response("Upstream error", { status: 502 });
        }
        const contentRange = upstream.headers.get("content-range");
        return new Response(upstream.body, {
          status: upstream.status === 206 ? 206 : 200,
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
            "Accept-Ranges": "bytes",
            ...(contentRange ? { "Content-Range": contentRange } : {}),
          },
        });

      },
    },
  },
});
