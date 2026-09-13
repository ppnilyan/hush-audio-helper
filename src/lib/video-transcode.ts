/**
 * Conversion vidéo dans le navigateur (ffmpeg.wasm) vers du MP4 H.264/AAC,
 * le seul format lisible partout, y compris sur iPhone.
 */
const CORE_BASES = [
  "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd",
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd",
];

let ffmpegPromise: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null = null;

async function loadFrom(base: string) {
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util"),
  ]);
  const ffmpeg = new FFmpeg();
  ffmpeg.on("log", ({ message }) => console.debug("[ffmpeg]", message));
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
  });
  return ffmpeg;
}

async function getFfmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      let lastError: unknown = null;
      for (const base of CORE_BASES) {
        try {
          return await loadFrom(base);
        } catch (e) {
          lastError = e;
        }
      }
      throw new Error(
        `moteur de conversion indisponible : ${lastError instanceof Error ? lastError.message : "erreur réseau"}`,
      );
    })();
    ffmpegPromise.catch(() => {
      ffmpegPromise = null;
    });
  }
  return ffmpegPromise;
}

/** Convertit un fichier vidéo en MP4 H.264 + AAC. */
export async function transcodeToH264(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<File> {
  const ffmpeg = await getFfmpeg();
  const { fetchFile } = await import("@ffmpeg/util");

  const handler = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(Math.max(0, Math.min(1, progress)));
  };
  ffmpeg.on("progress", handler);

  const input = `in-${Date.now()}`;
  const output = `out-${Date.now()}.mp4`;
  try {
    await ffmpeg.writeFile(input, await fetchFile(file));
    const code = await ffmpeg.exec([
      "-i",
      input,
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      output,
    ]);
    if (code !== 0) throw new Error(`conversion interrompue (code ${code})`);
    const data = (await ffmpeg.readFile(output)) as Uint8Array;
    if (!data || data.length === 0) throw new Error("fichier converti vide");
    const name = file.name.replace(/\.[^.]+$/, "") + "-h264.mp4";
    return new File([new Uint8Array(data).buffer as ArrayBuffer], name, { type: "video/mp4" });
  } finally {
    ffmpeg.off("progress", handler);
    await ffmpeg.deleteFile(input).catch(() => {});
    await ffmpeg.deleteFile(output).catch(() => {});
  }
}

/**
 * Rend un enregistrement MediaRecorder lisible par les applis (WhatsApp, TikTok,
 * galerie). Les navigateurs écrivent un MP4 *fragmenté* : Chrome et Safari
 * relisent leurs propres fragments sans problème, mais la plupart des lecteurs
 * tiers ne lisent que le premier index et gèlent sur une image au bout de
 * quelques secondes. Le remux (`-c copy`) reconstruit un MP4 progressif avec
 * un index complet et `faststart` ; si l'audio reste illisible, on ré-encode
 * uniquement l'audio.
 */
/**
 * Finalisation « tout propre » : on ré-encode entièrement l'enregistrement en
 * MP4 H.264 progressif, cadence constante (60 ips) et audio AAC 48 kHz stéréo.
 * Indispensable sur iPhone : Safari écrit un MP4 fragmenté avec des
 * horodatages irréguliers (voire des morceaux dans le désordre), que WhatsApp
 * et TikTok relisent de travers. Le ré-encodage réécrit une piste linéaire du
 * début à la fin.
 */
export async function normalizeForCompat(
  blob: Blob,
  durationSeconds: number,
  onProgress?: (ratio: number) => void,
): Promise<{ blob: Blob; ext: string } | null> {
  const ffmpeg = await getFfmpeg();
  const { fetchFile } = await import("@ffmpeg/util");
  const handler = ({ progress }: { progress: number }) =>
    onProgress?.(Math.max(0, Math.min(1, progress)));
  ffmpeg.on("progress", handler);

  const isMp4 = blob.type.includes("mp4");
  const input = `raw-${Date.now()}.${isMp4 ? "mp4" : "webm"}`;
  const output = `clean-${Date.now()}.mp4`;
  // Vise environ 250 Mio au total. Les bornes évitent une compression trop
  // forte sur les vidéos longues et un débit déraisonnable sur les très courtes.
  const targetBytes = 250 * 1_048_576;
  const audioBitrate = 320_000;
  const targetVideoBitrate = Math.round(
    Math.min(
      100_000_000,
      Math.max(24_000_000, (targetBytes * 8) / Math.max(1, durationSeconds) - audioBitrate),
    ),
  );
  const targetVideoKbps = `${Math.round(targetVideoBitrate / 1_000)}k`;
  const maxVideoKbps = `${Math.round((targetVideoBitrate * 1.08) / 1_000)}k`;
  const bufferKbps = `${Math.round((targetVideoBitrate * 2) / 1_000)}k`;
  try {
    await ffmpeg.writeFile(input, await fetchFile(blob));
    const code = await ffmpeg.exec([
      "-fflags",
      "+genpts+igndts",
      "-i",
      input,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      // Vidéo : H.264 haute qualité, 1080p conservé, cadence constante.
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-level",
      "5.2",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "veryfast",
      "-b:v",
      targetVideoKbps,
      "-maxrate",
      maxVideoKbps,
      "-bufsize",
      bufferKbps,
      "-r",
      "60",
      "-fps_mode",
      "cfr",
      "-g",
      "120",
      // Audio : AAC propre, rééchantillonné, sans trous.
      "-c:a",
      "aac",
      "-b:a",
      "320k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-af",
      "aresample=async=1:first_pts=0",
      "-video_track_timescale",
      "90000",
      "-movflags",
      "+faststart",
      output,
    ]);
    if (code !== 0) throw new Error(`code ${code}`);
    const data = (await ffmpeg.readFile(output)) as Uint8Array;
    if (!data || data.length === 0) throw new Error("sortie vide");
    return {
      blob: new Blob([new Uint8Array(data).buffer as ArrayBuffer], { type: "video/mp4" }),
      ext: "mp4",
    };
  } catch {
    return null;
  } finally {
    ffmpeg.off("progress", handler);
    await ffmpeg.deleteFile(input).catch(() => {});
    await ffmpeg.deleteFile(output).catch(() => {});
  }
}

export async function remuxForCompat(
  blob: Blob,
  onProgress?: (ratio: number) => void,
): Promise<{ blob: Blob; ext: string }> {
  const isMp4 = blob.type.includes("mp4");
  if (!isMp4) return { blob, ext: "webm" };

  const ffmpeg = await getFfmpeg();
  const { fetchFile } = await import("@ffmpeg/util");
  const handler = ({ progress }: { progress: number }) =>
    onProgress?.(Math.max(0, Math.min(1, progress)));
  ffmpeg.on("progress", handler);

  const input = `rec-${Date.now()}.mp4`;
  const attempts: string[][] = [
    ["-c", "copy"],
    ["-c:v", "copy", "-c:a", "aac", "-b:a", "160k"],
  ];

  try {
    await ffmpeg.writeFile(input, await fetchFile(blob));
    for (let i = 0; i < attempts.length; i++) {
      const output = `fix-${Date.now()}-${i}.mp4`;
      try {
        const code = await ffmpeg.exec([
          "-fflags",
          "+genpts",
          "-i",
          input,
          ...attempts[i]!,
          // Index complet + horodatages réguliers : les lecteurs tiers
          // (WhatsApp, TikTok) ne gèlent plus au milieu de la vidéo.
          "-video_track_timescale",
          "90000",
          "-movflags",
          "+faststart",

          output,
        ]);
        if (code !== 0) throw new Error(`code ${code}`);
        const data = (await ffmpeg.readFile(output)) as Uint8Array;
        if (!data || data.length === 0) throw new Error("sortie vide");
        return {
          blob: new Blob([new Uint8Array(data).buffer as ArrayBuffer], { type: "video/mp4" }),
          ext: "mp4",
        };
      } catch {
        /* on tente la stratégie suivante */
      } finally {
        await ffmpeg.deleteFile(output).catch(() => {});
      }
    }
    return { blob, ext: "mp4" };
  } catch {
    return { blob, ext: "mp4" };
  } finally {
    ffmpeg.off("progress", handler);
    await ffmpeg.deleteFile(input).catch(() => {});
  }
}
