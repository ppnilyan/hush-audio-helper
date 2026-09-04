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

// Le CDN TikTok exige les cookies de la page vidéo : on les garde en mémoire un moment.
const cookieCache = new Map<string, { at: number; cookie: string }>();
const COOKIE_TTL_MS = 10 * 60 * 1000;

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

async function tiktokCookieFor(pageUrl: URL): Promise<string> {
  const key = pageUrl.toString();
  const hot = cookieCache.get(key);
  if (hot && Date.now() - hot.at < COOKIE_TTL_MS) return hot.cookie;
  const res = await fetch(key, {
    redirect: "follow",
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
  });
  const raw = res.headers.get("set-cookie") ?? "";
  // On ne lit pas le corps : seuls les cookies nous intéressent.
  void res.body?.cancel();
  const cookie = raw
    .split(/,(?=[^;]+?=)/)
    .map((c) => c.split(";")[0]!.trim())
    .filter(Boolean)
    .join("; ");
  cookieCache.set(key, { at: Date.now(), cookie });
  return cookie;
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
