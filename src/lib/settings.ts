import {
  MIXED_EFFECTS,
  defaultEffects,
  defaultHook,
  type Effects,
  type HookSettings,
  type MixedEffectName,
} from "@/lib/montage";
import { DEFAULT_MUSIC_GAIN_DB } from "@/lib/music-store";

/** Choix de musique de fond mémorisé sur le compte. */
export type MusicChoice = "none" | "builtin";

/** Tous les réglages du montage, sauvegardés sur le compte. */
export type MontageSettings = {
  /** Durée (s) de chacun des 3 premiers clips de l'intro. */
  intros: [number, number, number];
  fx: Effects;
  /** Étape « Hook & Effets » : zoom dynamique et effets mélangés. */
  hook: HookSettings;
  /** Volume de la musique de fond, en dB (0 = plein volume). */
  musicGainDb: number;
  /** Piste retenue par défaut (un fichier importé reste local à la session). */
  musicChoice: MusicChoice;
  /** Volume de la voix off importée, en % (100 = volume d'origine). */
  voiceGainPercent: number;
};

export const defaultSettings: MontageSettings = {
  intros: [0.5, 0.5, 0.5],
  fx: defaultEffects,
  hook: defaultHook,
  musicGainDb: DEFAULT_MUSIC_GAIN_DB,
  musicChoice: "none",
  voiceGainPercent: 100,
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
    hook: normalizeHook(src.hook),
    musicGainDb: Math.min(0, Math.max(-40, num(src.musicGainDb, DEFAULT_MUSIC_GAIN_DB))),
    musicChoice: src.musicChoice === "builtin" ? "builtin" : "none",
  };
}

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function normalizeHook(raw: unknown): HookSettings {
  const h = (raw ?? {}) as Partial<HookSettings>;
  const effects = Array.isArray(h.mixedEffects)
    ? (h.mixedEffects.filter((e) => MIXED_EFFECTS.includes(e as MixedEffectName)) as MixedEffectName[])
    : defaultHook.mixedEffects;
  const easing = (v: unknown, fb: HookSettings["hookEasing"]) =>
    v === "linear" || v === "easeOut" || v === "easeInOut" || v === "punchy" ? v : fb;
  return {
    hookEnabled: bool(h.hookEnabled, defaultHook.hookEnabled),
    hookIntensity: clamp(num(h.hookIntensity, defaultHook.hookIntensity), 5, 60),
    hookDirection: h.hookDirection === "out" ? "out" : "in",
    hookDuration: clamp(num(h.hookDuration, defaultHook.hookDuration), 0.1, 1),
    hookEasing: easing(h.hookEasing, defaultHook.hookEasing),
    mixedEnabled: bool(h.mixedEnabled, defaultHook.mixedEnabled),
    mixedEffects: effects.length ? effects : defaultHook.mixedEffects,
    mixedEveryCuts: clamp(Math.round(num(h.mixedEveryCuts, defaultHook.mixedEveryCuts)), 1, 8),
    mixedDuration: clamp(num(h.mixedDuration, defaultHook.mixedDuration), 0.2, 2),
    mixedIntensity: clamp(num(h.mixedIntensity, defaultHook.mixedIntensity), 5, 60),
    mixedEasing: easing(h.mixedEasing, defaultHook.mixedEasing),
  };
}
