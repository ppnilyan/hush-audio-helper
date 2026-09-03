import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ url: z.string().url(), hdOnly: z.boolean().optional() });

export const resolveTikTok = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
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
    if (data.hdOnly && !hd) {
      throw new Error("Aucune version HD n'est disponible pour cette vidéo.");
    }
    const chosen = data.hdOnly ? hd! : play;
    const absolute = chosen.startsWith("http") ? chosen : `https://www.tikwm.com${chosen}`;
    const rawViews = Number(json.data?.play_count);
    return {
      playUrl: absolute,
      hd: !!hd,
      title: json.data?.title ?? "Clip TikTok",
      duration: json.data?.duration ?? 0,
      views: Number.isFinite(rawViews) ? rawViews : undefined,
    };
  });

