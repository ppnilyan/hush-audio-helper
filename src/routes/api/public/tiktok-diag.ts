import { createFileRoute } from "@tanstack/react-router";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Route de diagnostic temporaire : teste les en-têtes nécessaires au CDN TikTok.
export const Route = createFileRoute("/api/public/tiktok-diag")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url).searchParams.get("url");
        if (!u) return new Response("Missing url", { status: 400 });
        const page = await fetch(u, {
          redirect: "follow",
          headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
        });
        const html = await page.text();
        const setCookie = page.headers.get("set-cookie") ?? "";
        const cookie = setCookie
          .split(/,(?=[^;]+?=)/)
          .map((c) => c.split(";")[0]!.trim())
          .filter(Boolean)
          .join("; ");
        const marker = 'id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">';
        const start = html.indexOf(marker);
        const end = start === -1 ? -1 : html.indexOf("</script>", start);
        let playUrl = "";
        if (start !== -1 && end !== -1) {
          try {
            const parsed = JSON.parse(html.slice(start + marker.length, end)) as any;
            const item = parsed?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
            const list = item?.video?.bitrateInfo ?? [];
            playUrl =
              [...list].sort((a: any, b: any) => (b.Bitrate ?? 0) - (a.Bitrate ?? 0))[0]?.PlayAddr
                ?.UrlList?.[0] ??
              item?.video?.playAddr ??
              "";
          } catch {
            playUrl = "";
          }
        }
        const out: Record<string, string> = { cookieLen: String(cookie.length) };
        const variants: Array<[string, Record<string, string>]> = [
          ["plain", {}],
          ["referer", { Referer: "https://www.tiktok.com/" }],
          ["cookie", { Referer: "https://www.tiktok.com/", Cookie: cookie }],
          [
            "cookie-range",
            { Referer: "https://www.tiktok.com/", Cookie: cookie, Range: "bytes=0-1000" },
          ],
        ];
        if (playUrl) {
          await Promise.all(
            variants.map(async ([name, extra]) => {
              try {
                const r = await fetch(playUrl, { headers: { "User-Agent": UA, ...extra } });
                out[name] = `${r.status} ct=${r.headers.get("content-type")} len=${(await r.arrayBuffer()).byteLength}`;
              } catch (e) {
                out[name] = `ERR ${(e as Error).message}`;
              }
            }),
          );
        }
        return Response.json({ playUrl: playUrl.slice(0, 80), ...out });
      },
    },
  },
});
