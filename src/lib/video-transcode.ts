/**
 * Conversion vidéo dans le navigateur (ffmpeg.wasm) vers du MP4 H.264/AAC,
 * le seul format lisible partout, y compris sur iPhone.
 */
import coreJsAsset from "@/assets/ffmpeg/ffmpeg-core.js.asset.json";
import coreWasmAsset from "@/assets/ffmpeg/ffmpeg-core.wasm.asset.json";

type CoreSource = { core: string; wasm: string };

/** Copie hébergée par l'application (même origine, la plus fiable sur iPhone),
 *  puis replis publics si jamais elle est indisponible. */
const CORE_SOURCES: CoreSource[] = [
  { core: coreJsAsset.url, wasm: coreWasmAsset.url },
  {
    core: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js",
    wasm: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm",
  },
  {
    core: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js",
    wasm: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm",
  },
];

let ffmpegPromise: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null = null;

function isSameOrigin(url: string) {
  return url.startsWith("/") || (typeof location !== "undefined" && url.startsWith(location.origin));
}

async function loadFrom(source: CoreSource) {
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util"),
  ]);
  const ffmpeg = new FFmpeg();
  ffmpeg.on("log", ({ message }) => console.debug("[ffmpeg]", message));
  await ffmpeg.load({
    coreURL: await toBlobURL(source.core, "text/javascript"),
    // Sur une même origine on laisse le moteur télécharger le wasm lui-même :
    // cela évite de garder 32 Mo en mémoire, ce qui faisait échouer l'iPhone.
    wasmURL: isSameOrigin(source.wasm)
      ? source.wasm
      : await toBlobURL(source.wasm, "application/wasm"),
  });
  return ffmpeg;
}

async function getFfmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      let lastError: unknown = null;
      for (const source of CORE_SOURCES) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            return await loadFrom(source);
          } catch (e) {
            lastError = e;
            await new Promise((r) => setTimeout(r, 600));
          }
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
 * Réécrit intégralement le montage en une seule piste MP4 linéaire. Le CRF
 * privilégie la qualité sans imposer de taille : le poids dépend uniquement
 * de la durée et de la complexité réelle des images.
 */
export async function normalizeForCompat(
  blob: Blob,
  durationSeconds: number,
  onProgress?: (ratio: number) => void,
): Promise<{ blob: Blob; ext: "mp4" }> {
  const ffmpeg = await getFfmpeg();
  const { fetchFile } = await import("@ffmpeg/util");
  const handler = ({ progress }: { progress: number }) =>
    onProgress?.(Math.max(0, Math.min(1, progress)));
  ffmpeg.on("progress", handler);

  const isMp4 = blob.type.includes("mp4");
  const input = `raw-${Date.now()}.${isMp4 ? "mp4" : "webm"}`;
  const output = `clean-${Date.now()}.mp4`;
  try {
    await ffmpeg.writeFile(input, await fetchFile(blob));
    const code = await ffmpeg.exec([
      "-fflags",
      "+genpts+discardcorrupt",
      "-i",
      input,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      // Une image de sortie pour chaque instant de la cadence 60 ips. Cela
      // élimine les horodatages irréguliers créés par MediaRecorder.
      "-vf",
      "fps=60:round=near,setpts=N/(60*TB),scale=1080:1920:flags=lanczos,setsar=1",
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-level",
      "5.2",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "fast",
      "-crf",
      "12",
      "-r",
      "60",
      "-fps_mode",
      "cfr",
      "-g",
      "120",
      "-keyint_min",
      "60",
      "-sc_threshold",
      "0",
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
      "asetpts=N/SR/TB,aresample=async=1:first_pts=0,apad",
      "-t",
      Math.max(0.1, durationSeconds).toFixed(3),
      "-avoid_negative_ts",
      "make_zero",
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
  } catch (error) {
    throw new Error(
      `La finalisation MP4 a échoué : ${error instanceof Error ? error.message : "erreur inconnue"}`,
    );
  } finally {
    ffmpeg.off("progress", handler);
    await ffmpeg.deleteFile(input).catch(() => {});
    await ffmpeg.deleteFile(output).catch(() => {});
  }
}

/** Refuse un fichier incomplet avant qu'il soit ajouté à l'historique. */
export async function verifyFinalVideo(blob: Blob, expectedDuration: number): Promise<void> {
  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error("lecture du fichier final impossible")),
        15_000,
      );
      video.onloadedmetadata = () => {
        window.clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("fichier MP4 final illisible"));
      };
    });
    if (video.videoWidth !== 1080 || video.videoHeight !== 1920) {
      throw new Error(`résolution finale incorrecte (${video.videoWidth}×${video.videoHeight})`);
    }
    if (!Number.isFinite(video.duration) || Math.abs(video.duration - expectedDuration) > 0.75) {
      throw new Error("durée finale incomplète");
    }
  } finally {
    URL.revokeObjectURL(url);
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
