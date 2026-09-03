import builtinAsset from "@/assets/mysterious-and-sad.mp3.asset.json";

/** Musique de fond du montage : piste incluse ou fichier importé. */
export type MusicTrack = {
  url: string;
  name: string;
  /** true = piste fournie avec l'app, false = fichier importé par l'utilisateur. */
  builtin: boolean;
};

/** La musique ne joue jamais plus de 2 minutes, même si la voix off est plus longue. */
export const MUSIC_MAX_SECONDS = 120;

/** Fondu de sortie (s) pour éviter une coupure sèche à la fin. */
export const MUSIC_FADE_SECONDS = 0.8;

export const BUILTIN_MUSIC: MusicTrack = {
  url: builtinAsset.url,
  name: "Mysterious and Sad",
  builtin: true,
};

/** Volume de la musique par défaut : très en retrait derrière la voix. */
export const DEFAULT_MUSIC_GAIN_DB = -30;

/** Convertit des décibels en gain linéaire (−30 dB ≈ 0,0316). */
export function dbToGain(db: number) {
  return Math.pow(10, db / 20);
}

let current: MusicTrack | null = null;
const listeners = new Set<(v: MusicTrack | null) => void>();

export function setMusic(v: MusicTrack | null) {
  current = v;
  listeners.forEach((l) => l(current));
}

export function getMusic() {
  return current;
}

export function subscribeMusic(l: (v: MusicTrack | null) => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
