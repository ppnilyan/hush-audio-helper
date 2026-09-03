import { defaultEffects, type Effects } from "@/lib/montage";
import { DEFAULT_MUSIC_GAIN_DB } from "@/lib/music-store";

/** Choix de musique de fond mémorisé sur le compte. */
export type MusicChoice = "none" | "builtin";

/** Tous les réglages du montage, sauvegardés sur le compte. */
export type MontageSettings = {
  /** Durée (s) de chacun des 3 premiers clips de l'intro. */
  intros: [number, number, number];
  fx: Effects;
  /** Volume de la musique de fond, en dB (0 = plein volume). */
  musicGainDb: number;
  /** Piste retenue par défaut (un fichier importé reste local à la session). */
  musicChoice: MusicChoice;
};

export const defaultSettings: MontageSettings = {
  intros: [0.5, 0.5, 0.5],
  fx: defaultEffects,
  musicGainDb: DEFAULT_MUSIC_GAIN_DB,
  musicChoice: "none",
};

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Fusionne des réglages venant du compte avec les valeurs par défaut. */
export function normalizeSettings(raw: unknown): MontageSettings {
  const src = (raw ?? {}) as Partial<MontageSettings> & { intro?: number };
  const legacy = typeof src.intro === "number" ? src.intro : null;
  const intros = Array.isArray(src.intros) ? src.intros : [];
  const fxSrc = (src.fx ?? {}) as Partial<Effects>;
  return {
    intros: [0, 1, 2].map((i) =>
      num(intros[i], legacy ?? defaultSettings.intros[i]!),
    ) as [number, number, number],
    fx: {
      mirror: typeof fxSrc.mirror === "boolean" ? fxSrc.mirror : defaultEffects.mirror,
      zoom: num(fxSrc.zoom, defaultEffects.zoom),
      speed: num(fxSrc.speed, defaultEffects.speed),
      brightness: num(fxSrc.brightness, defaultEffects.brightness),
      contrast: num(fxSrc.contrast, defaultEffects.contrast),
      saturation: num(fxSrc.saturation, defaultEffects.saturation),
      blurTop: num(fxSrc.blurTop, defaultEffects.blurTop),
      blurBottom: num(fxSrc.blurBottom, defaultEffects.blurBottom),
      blurIntensity: num(fxSrc.blurIntensity, defaultEffects.blurIntensity),
    },
    musicGainDb: Math.min(0, Math.max(-40, num(src.musicGainDb, DEFAULT_MUSIC_GAIN_DB))),
    musicChoice: src.musicChoice === "builtin" ? "builtin" : "none",
  };
}
