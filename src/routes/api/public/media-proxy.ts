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


export const Route = createFileRoute("/api/public/media-proxy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get("url");
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
        const upstream = await fetch(parsed.toString(), {
          headers: {
            "User-Agent": fromTikwm
              ? "Mozilla/5.0"
              : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Referer: fromTikwm ? "https://www.tikwm.com/" : "https://www.tiktok.com/",
            ...(parsed.hostname.endsWith("tikwm.com") ? {} : { Origin: "https://www.tiktok.com" }),
            ...(request.headers.get("range") ? { Range: request.headers.get("range")! } : {}),
          },
        });

        if (!upstream.ok || !upstream.body) {
          return new Response("Upstream error", { status: 502 });
        }
        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
