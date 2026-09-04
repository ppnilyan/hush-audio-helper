import { createFileRoute } from "@tanstack/react-router";

// Route de diagnostic temporaire : teste quels fournisseurs répondent depuis le serveur.
export const Route = createFileRoute("/api/public/tiktok-diag")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url).searchParams.get("url");
        if (!u) return new Response("Missing url", { status: 400 });
        const enc = encodeURIComponent(u);
        const tikwm = `https://www.tikwm.com/api/?url=${enc}&hd=1`;
        const targets: Array<[string, string]> = [
          ["tikwm", tikwm],
          ["tikwm-bare", `https://tikwm.com/api/?url=${enc}`],
          ["tiklydown", `https://api.tiklydown.eu.org/api/download?url=${enc}`],
          ["douyinwtf", `https://api.douyin.wtf/api/hybrid/video_data?url=${enc}&minimal=true`],
          ["codetabs", `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(tikwm)}`],
          ["allorigins", `https://api.allorigins.win/raw?url=${encodeURIComponent(tikwm)}`],
          ["oembed", `https://www.tiktok.com/oembed?url=${enc}`],
          ["tikmate", `https://api.tikmate.app/api/lookup?url=${enc}`],
        ];
        const out: Record<string, string> = {};
        await Promise.all(
          targets.map(async ([name, url]) => {
            try {
              const res = await fetch(url, {
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
                  Accept: "application/json",
                },
              });
              out[name] = `${res.status} ${(await res.text()).slice(0, 160)}`;
            } catch (e) {
              out[name] = `ERR ${(e as Error).message}`;
            }
          }),
        );
        return new Response(JSON.stringify(out, null, 2), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
