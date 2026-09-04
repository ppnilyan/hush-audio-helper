import { createFileRoute } from "@tanstack/react-router";

// Route de diagnostic temporaire : teste quels fournisseurs répondent depuis le serveur.
export const Route = createFileRoute("/api/public/tiktok-diag")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url).searchParams.get("url");
        if (!u) return new Response("Missing url", { status: 400 });
        const id = /(\d{15,})/.exec(u)?.[1] ?? "";
        const enc = encodeURIComponent(u);
        const targets: Array<[string, string, RequestInit?]> = [
          ["page", u, {}],
          [
            "aweme-useast",
            `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${id}&version_code=262&app_name=musical_ly&channel=App&device_platform=android&device_type=SM-G981B&os_version=10&aid=1180`,
            {},
          ],
          [
            "aweme-alisg",
            `https://api22-normal-c-alisg.tiktokv.com/aweme/v1/feed/?aweme_id=${id}&version_code=262&app_name=musical_ly&channel=App&device_platform=android&device_type=SM-G981B&os_version=10&aid=1180`,
            {},
          ],
          ["oembed", `https://www.tiktok.com/oembed?url=${enc}`, {}],
        ];
        const out: Record<string, string> = {};
        await Promise.all(
          targets.map(async ([name, url, init]) => {
            try {
              const res = await fetch(url, {
                ...init,
                headers: {
                  "User-Agent":
                    name === "page"
                      ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
                      : "com.ss.android.ugc.trill/2613 (Linux; U; Android 10; en; SM-G981B; Build/QP1A.190711.020)",
                  Accept: "*/*",
                },
              });
              const text = await res.text();
              if (name === "page") {
                const m = /"playAddr":"(.*?)"/.exec(text);
                out[name] = `${res.status} len=${text.length} play=${m ? m[1]!.slice(0, 120) : "none"}`;
              } else if (name.startsWith("aweme")) {
                const m = /"url_list":\["(.*?)"/.exec(text);
                out[name] = `${res.status} len=${text.length} first=${m ? m[1]!.slice(0, 120) : "none"}`;
              } else {
                out[name] = `${res.status} ${text.slice(0, 120)}`;
              }
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
