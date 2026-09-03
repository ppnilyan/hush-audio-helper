import { useEffect, useState } from "react";

import { defaultEffects, type Effects } from "@/lib/montage";
import { DEFAULT_MUSIC_GAIN_DB } from "@/lib/music-store";
import type { MontageSettings } from "@/lib/settings";

const KEY = "montage.advanced";

let current = false;
const listeners = new Set<(v: boolean) => void>();

export function getAdvanced() {
  return current;
}

export function setAdvanced(v: boolean) {
  current = v;
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    /* stockage indisponible */
  }
  listeners.forEach((l) => l(v));
}

/** Mode simple / avancé, partagé entre l'en-tête et le parcours de montage. */
export function useAdvanced() {
  const [advanced, setState] = useState(current);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored !== null) {
        current = stored === "1";
        setState(current);
      }
    } catch {
      /* stockage indisponible */
    }
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return { advanced, setAdvanced };
}

/** Réglages appliqués automatiquement en mode simple. */
export const SIMPLE_EFFECTS: Effects = {
  ...defaultEffects,
  zoom: 110,
  speed: 1.2,
  brightness: 110,
  contrast: 95,
  saturation: 110,
  blurTop: 12,
  blurBottom: 12,
  blurIntensity: 18,
};

export const SIMPLE_INTROS: MontageSettings["intros"] = [2, 2, 2];

/** Détection des blancs en mode simple : ≥ 0,05 s, −45 dB, cible 1 min 02. */
export const SIMPLE_SILENCE = {
  range: [0.05, 2] as [number, number],
  thresholdDb: -45,
  targetMin: 1,
  targetSec: 2,
};

export const SIMPLE_MUSIC_GAIN_DB = DEFAULT_MUSIC_GAIN_DB;
