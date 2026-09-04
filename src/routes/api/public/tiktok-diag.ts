import { createFileRoute } from "@tanstack/react-router";

// Route de diagnostic temporaire : vérifie la récupération directe + le proxy média.
export const Route = createFileRoute("/api/public/tiktok-diag")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const reqUrl = new URL(request.url);
        const u = reqUrl.searchParams.get("url");
        if (!u) return new Response("Missing url", { status: 400 });
        const page = await fetch(u, {
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        const html = await page.text();
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
        let proxy = "skipped";
        if (playUrl) {
          const p = await fetch(
            `${reqUrl.origin}/api/public/media-proxy?url=${encodeURIComponent(playUrl)}`,
            { headers: { Range: "bytes=0-1000" } },
          );
          proxy = `${p.status} ${p.headers.get("content-type")} len=${(await p.arrayBuffer()).byteLength}`;
        }
        return Response.json({ pageStatus: page.status, playUrl: playUrl.slice(0, 90), proxy });
      },
    },
  },
});
