export type ClipInfo = {
  id: string;
  name: string;
  url: string;
  duration: number;
  width?: number;
  height?: number;
  /** Nombre de vues TikTok, quand il est connu (lien résolu). */
  views?: number | undefined;
  /** Lien TikTok d'origine, pour retenter une récupération en HD. */
  sourceUrl?: string | undefined;
};


/**
 * Les 3 clips les plus vus passent en tête (tri décroissant) pour alimenter
 * les coupes rapides de l'intro ; tous les autres gardent leur ordre d'ajout.
 * Les clips sans vues connues comptent pour 0.
 */
export function orderByViews(clips: ClipInfo[]): ClipInfo[] {
  const withRank = clips.map((clip, index) => ({ clip, index }));
  withRank.sort((a, b) => (b.clip.views ?? 0) - (a.clip.views ?? 0) || a.index - b.index);
  const top = withRank.slice(0, 3).map((x) => x.clip);
  const topIds = new Set(top.map((c) => c.id));
  const rest = clips.filter((c) => !topIds.has(c.id));
  return [...top, ...rest];
}

/** 1 234 567 → "1,2 M" ; 12 300 → "12,3 k" */
export function formatViews(views: number): string {
  if (views >= 1_000_000)
    return `${(views / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (views >= 1_000)
    return `${(views / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k`;
  return views.toLocaleString("fr-FR");
}

/** A clip counts as HD when its smallest side is at least 720 px (e.g. 720x1280). */
export const isHd = (c: { width?: number; height?: number }) =>
  !!c.width && !!c.height && Math.min(c.width, c.height) >= 720;

export type Segment = { clip: number; start: number; duration: number };

export type Effects = {
  mirror: boolean;
  zoom: number; // 90 - 120 (%)
  speed: number;
  brightness: number; // %
  contrast: number; // %
  saturation: number; // %
  blurTop: number; // % of height
  blurBottom: number; // % of height
  blurIntensity: number; // px
};

export const defaultEffects: Effects = {
  mirror: true,
  zoom: 105,
  speed: 1,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blurTop: 12,
  blurBottom: 12,
  blurIntensity: 18,
};

/**
 * Intro: `introDuration` seconds from each of the first three clips
 * (a number applies to all three, an array sets each one individually).
 * Then clips alternate: 5 s each on the first pass, 10 s each on the second,
 * and so on until the montage matches the voice-over duration.
 */
export function buildTimeline(
  clips: ClipInfo[],
  totalDuration: number,
  introDuration: number | number[] = 0.5,
): Segment[] {
  if (clips.length === 0 || totalDuration <= 0) return [];
  const segments: Segment[] = [];
  const heads = clips.map(() => 0);
  let time = 0;

  const introAt = (i: number) =>
    Math.max(
      0,
      Array.isArray(introDuration) ? (introDuration[i] ?? 0) : introDuration,
    );
  const introCount = Math.min(3, clips.length);
  for (let i = 0; i < introCount && time < totalDuration; i++) {
    const intro = introAt(i);
    if (intro <= 0) continue;
    const d = Math.min(intro, totalDuration - time);
    segments.push({ clip: i, start: 0, duration: d });
    heads[i] = intro;
    time += d;
  }



  let pass = 0;
  let guard = 0;
  while (time < totalDuration - 0.05 && guard++ < 500) {
    const passLen = pass % 2 === 0 ? 5 : 10;
    for (let i = 0; i < clips.length && time < totalDuration - 0.05; i++) {
      const clip = clips[i]!;
      let start = heads[i]!;
      if (start + 1 >= clip.duration) start = 0;
      const available = Math.max(0.5, clip.duration - start);
      const d = Math.min(passLen, available, totalDuration - time);
      if (d <= 0.05) continue;
      segments.push({ clip: i, start, duration: d });
      heads[i] = start + d;
      time += d;
    }
    pass++;
  }

  // Make the montage match the target duration exactly.
  const sum = segments.reduce((a, s) => a + s.duration, 0);
  const last = segments[segments.length - 1];
  if (last) {
    const fixed = last.duration + (totalDuration - sum);
    last.duration = Math.max(0.05, fixed);
  }
  return segments;
}


/* ------------------------------------------------------------------ *
 * Étape « Hook & Effets » : zoom dynamique et effets mélangés
 * ------------------------------------------------------------------ */

export type EasingName = "linear" | "easeOut" | "easeInOut" | "punchy";

export type MixedEffectName =
  | "zoomIn"
  | "zoomOut"
  | "punch"
  | "shake"
  | "flash"
  | "tilt";

export const MIXED_EFFECTS: MixedEffectName[] = [
  "zoomIn",
  "zoomOut",
  "punch",
  "shake",
  "flash",
  "tilt",
];

export type HookSettings = {
  /** Zoom dynamique appliqué en intro du premier clip. */
  hookEnabled: boolean;
  /** Amplitude du zoom, en % de taille ajoutée (5 → 60). */
  hookIntensity: number;
  /** Sens du mouvement : zoom avant (in) ou zoom arrière (out). */
  hookDirection: "in" | "out";
  /** Durée de l'effet de hook, de 0,1 s à 1 s. */
  hookDuration: number;
  hookEasing: EasingName;
  /** Effets mélangés sur les coupures suivantes. */
  mixedEnabled: boolean;
  mixedEffects: MixedEffectName[];
  /** Un effet toutes les X coupures. */
  mixedEveryCuts: number;
  /** Durée de chaque effet mélangé, de 0,2 s à 2 s. */
  mixedDuration: number;
  mixedIntensity: number;
  mixedEasing: EasingName;
};

export const defaultHook: HookSettings = {
  hookEnabled: true,
  hookIntensity: 22,
  hookDirection: "in",
  hookDuration: 0.45,
  hookEasing: "punchy",
  mixedEnabled: false,
  mixedEffects: ["zoomIn", "zoomOut", "punch"],
  mixedEveryCuts: 2,
  mixedDuration: 0.5,
  mixedIntensity: 14,
  mixedEasing: "easeOut",
};

export function ease(name: EasingName, t: number): number {
  const x = Math.min(1, Math.max(0, t));
  switch (name) {
    case "linear":
      return x;
    case "easeInOut":
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case "punchy": {
      // Départ très rapide puis léger dépassement : la sensation « snap ».
      const c = 1.70158 + 1;
      const p = x - 1;
      return 1 + c * p * p * p + 1.70158 * p * p;
    }
    case "easeOut":
    default:
      return 1 - Math.pow(1 - x, 3);
  }
}

/** Modificateurs dynamiques appliqués image par image pendant le rendu. */
export type FrameFx = {
  zoom: number; // multiplicateur (1 = neutre)
  offsetX: number; // px
  offsetY: number; // px
  rotate: number; // radians
  brightness: number; // multiplicateur
};

export const neutralFrameFx: FrameFx = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotate: 0,
  brightness: 1,
};

export type ActiveEffect = {
  name: MixedEffectName;
  duration: number;
  intensity: number;
  easing: EasingName;
};

/**
 * Effet retenu pour une coupure : le hook ouvre le montage, puis les effets
 * mélangés reviennent toutes les X coupures en alternant la liste choisie.
 */
export function effectForSegment(
  index: number,
  hook: HookSettings,
): ActiveEffect | null {
  if (index === 0) {
    if (!hook.hookEnabled) return null;
    return {
      name: hook.hookDirection === "out" ? "zoomOut" : "zoomIn",
      duration: hook.hookDuration,
      intensity: hook.hookIntensity,
      easing: hook.hookEasing,
    };
  }
  if (!hook.mixedEnabled || hook.mixedEffects.length === 0) return null;
  const every = Math.max(1, Math.round(hook.mixedEveryCuts));
  if (index % every !== 0) return null;
  const pick = hook.mixedEffects[Math.floor(index / every - 1) % hook.mixedEffects.length]!;
  return {
    name: pick,
    duration: hook.mixedDuration,
    intensity: hook.mixedIntensity,
    easing: hook.mixedEasing,
  };
}

/** Valeur de l'effet à l'instant `t` (s) depuis le début du segment. */
export function frameFxAt(effect: ActiveEffect | null, t: number): FrameFx {
  if (!effect || effect.duration <= 0 || t >= effect.duration) return neutralFrameFx;
  const p = ease(effect.easing, t / effect.duration);
  const amount = Math.max(0, effect.intensity) / 100;
  const rest = 1 - p; // 1 au début de la coupure, 0 à la fin de l'effet
  switch (effect.name) {
    case "zoomIn":
      // Part large et se resserre : le sujet « avance » vers la caméra.
      return { ...neutralFrameFx, zoom: 1 + amount * p };
    case "zoomOut":
      return { ...neutralFrameFx, zoom: 1 + amount * rest };
    case "punch": {
      // Impulsion : pic immédiat puis retour au cadrage normal.
      const pulse = Math.sin(Math.PI * Math.min(1, t / effect.duration));
      return { ...neutralFrameFx, zoom: 1 + amount * pulse };
    }
    case "shake": {
      const decay = rest;
      const a = amount * 120 * decay;
      return {
        ...neutralFrameFx,
        zoom: 1 + amount * 0.35 * decay,
        offsetX: Math.sin(t * 38) * a,
        offsetY: Math.cos(t * 31) * a * 0.6,
      };
    }
    case "flash":
      return { ...neutralFrameFx, brightness: 1 + amount * 2 * rest };
    case "tilt":
      return {
        ...neutralFrameFx,
        zoom: 1 + amount * 0.5,
        rotate: amount * 0.25 * rest,
      };
    default:
      return neutralFrameFx;
  }
}

export function cssFilter(fx: Effects, brightnessMul = 1) {
  const b = Math.round(fx.brightness * brightnessMul);
  return `brightness(${b}%) contrast(${fx.contrast}%) saturate(${fx.saturation}%)`;
}

/** Draw one video frame into a 9:16 canvas with the chosen effects. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  fx: Effects,
  dyn: FrameFx = neutralFrameFx,
) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const vw = video.videoWidth || 1080;
  const vh = video.videoHeight || 1920;
  const scale = Math.max(W / vw, H / vh) * (fx.zoom / 100) * dyn.zoom;
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = (W - dw) / 2 + dyn.offsetX;
  const dy = (H - dh) / 2 + dyn.offsetY;

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.filter = cssFilter(fx, dyn.brightness);
  ctx.translate(W / 2, H / 2);
  if (dyn.rotate) ctx.rotate(dyn.rotate);
  if (fx.mirror) ctx.scale(-1, 1);
  ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(video, dx, dy, dw, dh);
  ctx.restore();

  // Redraw the source directly through clipped, blurred bands. This avoids
  // getImageData(), which synchronously stalls the GPU and caused cut freezes.
  const top = (fx.blurTop / 100) * H;
  const bottom = (fx.blurBottom / 100) * H;
  if (fx.blurIntensity > 0) {
    if (top > 0) drawBlurredBand(ctx, video, fx, dyn, dx, dy, dw, dh, 0, top);
    if (bottom > 0) drawBlurredBand(ctx, video, fx, dyn, dx, dy, dw, dh, H - bottom, bottom);
  }
}

function drawBlurredBand(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  fx: Effects,
  dyn: FrameFx,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  y: number,
  h: number,
) {
  const W = ctx.canvas.width;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y, W, h);
  ctx.clip();
  ctx.filter = `${cssFilter(fx, dyn.brightness)} blur(${fx.blurIntensity}px)`;
  ctx.translate(W / 2, ctx.canvas.height / 2);
  if (dyn.rotate) ctx.rotate(dyn.rotate);
  if (fx.mirror) ctx.scale(-1, 1);
  ctx.translate(-W / 2, -ctx.canvas.height / 2);
  ctx.drawImage(video, dx, dy, dw, dh);
  ctx.restore();
}

