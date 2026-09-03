import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { resolveTikTok } from "@/lib/tiktok.functions";
import {
  buildTimeline,
  drawFrame,
  effectForSegment,
  frameFxAt,
  MIXED_EFFECTS,
  formatViews,
  isHd,
  orderByViews,
  type ClipInfo,
  type Effects,
  type EasingName,
  type HookSettings,
  type MixedEffectName,
} from "@/lib/montage";
import { detectSilences, encodeWav, formatTime, trimToTarget } from "@/lib/audio-silence";
import {
  listMontages as listLocalMontages,
  deleteMontage as deleteLocalMontage,
  saveMontage as saveLocalMontage,
  pickRecordingType,
  remainingLabel,
  RETENTION_MS,
} from "@/lib/montage-history";
import {
  useSession,
  loadSettings,
  saveSettings,
  listPresets,
  upsertPreset,
  deletePreset,
  uploadMontage,
  listMontages as listCloudMontages,
  deleteMontage as deleteCloudMontage,
  type Preset,
} from "@/lib/account";
import { defaultSettings, type MontageSettings } from "@/lib/settings";
import {
  SIMPLE_EFFECTS,
  SIMPLE_INTROS,
  SIMPLE_MUSIC_GAIN_DB,
  SIMPLE_SILENCE,
  useAdvanced,
} from "@/lib/advanced-mode";
import { useLocale, useTr } from "@/lib/prefs";
import { CREDITS_PER_VIDEO, useBilling, useInvalidateBilling } from "@/lib/billing";
import { consumeCredits, refundCredits } from "@/lib/billing.functions";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  getVoiceover,
  setVoiceover,
  subscribeVoiceover,
  type Voiceover,
} from "@/lib/voiceover-store";
import {
  BUILTIN_MUSIC,
  MUSIC_FADE_SECONDS,
  MUSIC_MAX_SECONDS,
  dbToGain,
  getMusic,
  setMusic,
  subscribeMusic,
  type MusicTrack,
} from "@/lib/music-store";

type UIEntry = {
  id: string;
  url: string;
  createdAt: number;
  expiresAt: number;
  duration: number;
  ext: string;
  storagePath?: string;
};

export const Route = createFileRoute("/montage")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search["tab"] === "history" ? ("history" as const) : ("editor" as const),
  }),
  head: () => ({
    meta: [
      { title: "Montage 9:16 — clips TikTok, voix off et musique" },
      {
        name: "description",
        content:
          "Parcours guidé : ajoutez vos clips, réglez durées et effets, ajoutez un hook zoom dynamique, importez la voix off, ajoutez une musique de fond, prévisualisez puis générez un montage vertical.",
      },
      { property: "og:title", content: "Montage 9:16 — clips TikTok, voix off et musique" },
      {
        property: "og:description",
        content:
          "Clips → durées et effets → hook & effets → voix off → musique de fond → prévisualisation → génération, étape par étape.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Montage,
});

const W = 540;
const H = 960;

const STEPS = [
  "Clips",
  "Durées & effets",
  "Hook & Effets",
  "Voix off",
  "Musique de fond",
  "Prévisualisation",
] as const;

type LinkRow = {
  id: string;
  url: string;
  status: "idle" | "queued" | "loading" | "done" | "error";
  error?: string | undefined;
};

const newRow = (): LinkRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  url: "",
  status: "idle",
});

const EFFECT_LABELS: Record<MixedEffectName, string> = {
  zoomIn: "Zoom avant",
  zoomOut: "Zoom arrière",
  punch: "Punch",
  shake: "Secousse",
  flash: "Flash",
  tilt: "Inclinaison",
};

const EASINGS: { value: EasingName; label: string }[] = [
  { value: "punchy", label: "Snap (nerveux)" },
  { value: "easeOut", label: "Doux" },
  { value: "easeInOut", label: "Progressif" },
  { value: "linear", label: "Linéaire" },
];

function EasingPicker({
  label,
  value,
  onChange,
  tr,
}: {
  label: string;
  value: EasingName;
  onChange: (v: EasingName) => void;
  tr: (s: string) => string;
}) {
  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {EASINGS.map((e) => (
          <Button
            key={e.value}
            size="sm"
            variant={value === e.value ? "default" : "secondary"}
            onClick={() => onChange(e.value)}
          >
            {tr(e.label)}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Montage() {
  const tr = useTr();
  const locale = useLocale();
  const session = useSession();
  const userId = session?.user.id ?? null;
  const search = Route.useSearch();

  const [clips, setClips] = useState<ClipInfo[]>([]);
  const [rows, setRows] = useState<LinkRow[]>(() => [newRow()]);
  const [loading, setLoading] = useState(false);
  const [hdMenu, setHdMenu] = useState<string | null>(null);
  const [hdStatus, setHdStatus] = useState<
    Record<string, { busy: boolean; message?: string }>
  >({});

  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<MontageSettings>(defaultSettings);
  const [settingsReady, setSettingsReady] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [voice, setVoice] = useState<Voiceover | null>(getVoiceover());
  const [playing, setPlaying] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<UIEntry[]>([]);
  const [tab, setTab] = useState<"editor" | "history">(search.tab);
  const [step, setStep] = useState(0);
  const { advanced, setAdvanced } = useAdvanced();
  const billing = useBilling();
  const invalidateBilling = useInvalidateBilling();
  const consume = useServerFn(consumeCredits);
  const refund = useServerFn(refundCredits);
  const noCredits = billing.signedIn && !billing.loading && billing.totalCredits < CREDITS_PER_VIDEO;

  /** Étapes visibles : « Durées & effets » n'apparaît qu'en mode avancé. */
  const visibleSteps = useMemo(
    () => (advanced ? [0, 1, 2, 3, 4, 5] : [0, 2, 3, 4, 5]),
    [advanced],
  );
  const stepPos = Math.max(0, visibleSteps.indexOf(step));
  const isLastStep = stepPos === visibleSteps.length - 1;



  // Étape 3 — voix off
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioInfo, setAudioInfo] = useState<string | null>(null);
  const [trimBlanks, setTrimBlanks] = useState(false);
  const [targetMin, setTargetMin] = useState(1);
  const [targetSec, setTargetSec] = useState(2);
  const [threshold, setThreshold] = useState(-45);
  const [range, setRange] = useState<[number, number]>([0.1, 0.5]);
  const audioFileRef = useRef<HTMLInputElement>(null);

  // Étape 4 — musique de fond
  const [music, setMusicState] = useState<MusicTrack | null>(getMusic());
  const musicFileRef = useRef<HTMLInputElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);

  const fx = settings.fx;
  const intros = settings.intros;
  const setFx = useCallback(
    (next: Effects) => setSettings((s) => ({ ...s, fx: next })),
    [],
  );
  const setIntroAt = useCallback((i: number, v: number) => {
    setSettings((s) => {
      const intros = [...s.intros] as MontageSettings["intros"];
      intros[i] = v;
      return { ...s, intros };
    });
  }, []);

  const hook = settings.hook;
  const setHook = useCallback(
    (patch: Partial<HookSettings>) =>
      setSettings((s) => ({ ...s, hook: { ...s.hook, ...patch } })),
    [],
  );
  const toggleMixedEffect = useCallback((name: MixedEffectName) => {
    setSettings((s) => {
      const on = s.hook.mixedEffects.includes(name);
      const next = on
        ? s.hook.mixedEffects.filter((e) => e !== name)
        : [...s.hook.mixedEffects, name];
      return { ...s, hook: { ...s.hook, mixedEffects: next.length ? next : s.hook.mixedEffects } };
    });
  }, []);

  const musicGainDb = settings.musicGainDb;
  const setMusicGainDb = useCallback(
    (db: number) => setSettings((s) => ({ ...s, musicGainDb: db })),
    [],
  );
  /** Sélection de la musique : piste incluse, fichier importé ou aucune. */
  const chooseMusic = useCallback((track: MusicTrack | null) => {
    setMusic(track);
    setSettings((s) => ({
      ...s,
      musicChoice: track?.builtin ? "builtin" : "none",
    }));
  }, []);

  /** Mode simple : réglages figés sur les valeurs recommandées. */
  useEffect(() => {
    if (advanced) return;
    setStep((s) => (s === 1 ? 2 : s));
    setSettings((s) => ({
      ...s,
      fx: SIMPLE_EFFECTS,
      intros: SIMPLE_INTROS,
      musicGainDb: SIMPLE_MUSIC_GAIN_DB,
    }));
    setRange(SIMPLE_SILENCE.range);
    setThreshold(SIMPLE_SILENCE.thresholdDb);
    setTargetMin(SIMPLE_SILENCE.targetMin);
    setTargetSec(SIMPLE_SILENCE.targetSec);
  }, [advanced]);




  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioRef = useRef<HTMLAudioElement>(null);
  const fxRef = useRef(fx);
  const hookRef = useRef(hook);
  const abortRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef(false);

  useEffect(() => {
    setTab(search.tab);
  }, [search.tab]);

  useEffect(() => {
    fxRef.current = fx;
  }, [fx]);
  useEffect(() => {
    hookRef.current = hook;
  }, [hook]);
  useEffect(() => {
    const unsub = subscribeVoiceover(setVoice);
    const unsubMusic = subscribeMusic(setMusicState);
    return () => {
      unsub();
      unsubMusic();
    };
  }, []);

  // Réglages + presets du compte : restaurés automatiquement à la connexion.
  useEffect(() => {
    let alive = true;
    setSettingsReady(false);
    if (!userId) {
      setPresets([]);
      setSettings(defaultSettings);
      return () => {
        alive = false;
      };
    }
    void (async () => {
      const [saved, list] = await Promise.all([loadSettings(userId), listPresets(userId)]);
      if (!alive) return;
      setSettings(saved ?? defaultSettings);
      setPresets(list);
      setSettingsReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  // Sauvegarde automatique des derniers réglages (même sans preset).
  useEffect(() => {
    if (!userId || !settingsReady) return;
    const t = setTimeout(() => {
      void saveSettings(userId, settings).then(() => setSavedAt(Date.now()));
    }, 700);
    return () => clearTimeout(t);
  }, [userId, settingsReady, settings]);

  // Le choix « piste incluse » enregistré sur le compte est réappliqué.
  useEffect(() => {
    if (!settingsReady) return;
    if (settings.musicChoice === "builtin" && !getMusic()) setMusic(BUILTIN_MUSIC);
  }, [settingsReady, settings.musicChoice]);


  const refreshHistory = useCallback(async () => {
    if (userId) {
      const items = await listCloudMontages(userId).catch(() => []);
      setHistory(items);
    } else {
      const items = await listLocalMontages().catch(() => []);
      setHistory(items);
    }
  }, [userId]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  // Measure the real voice-over length from the audio file itself.
  const [measured, setMeasured] = useState<number | null>(null);
  useEffect(() => {
    setMeasured(null);
    if (!voice) return;
    let alive = true;
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.src = voice.url;
    const onMeta = () => {
      if (!alive) return;
      const d = a.duration;
      if (Number.isFinite(d) && d > 0) setMeasured(d);
      else setMeasured(voice.duration);
    };
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("error", () => alive && setMeasured(voice.duration));
    return () => {
      alive = false;
      a.removeEventListener("loadedmetadata", onMeta);
      a.src = "";
    };
  }, [voice]);

  const totalDuration = measured ?? voice?.duration ?? 0;
  const measuring = !!voice && measured === null;
  // Les 3 clips les plus vus ouvrent le montage (coupes rapides de l'intro).
  const orderedClips = useMemo(() => orderByViews(clips), [clips]);
  const timeline = useMemo(
    () => buildTimeline(orderedClips, totalDuration, intros),
    [orderedClips, totalDuration, intros],
  );

  const timelineDuration = useMemo(
    () => timeline.reduce((a, s) => a + s.duration, 0),
    [timeline],
  );

  const getVideo = useCallback((clip: ClipInfo, slot = 0) => {
    const key = `${clip.id}#${slot}`;
    let v = videosRef.current.get(key);
    if (!v) {
      v = document.createElement("video");
      v.src = clip.url;
      v.crossOrigin = "anonymous";
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      videosRef.current.set(key, v);
    }
    return v;
  }, []);

  const addFromUrl = useCallback(
    async (url: string, name: string, views?: number, sourceUrl?: string) => {
      const meta = document.createElement("video");
      meta.src = url;
      meta.muted = true;
      await new Promise<void>((res, rej) => {
        meta.onloadedmetadata = () => res();
        meta.onerror = () => rej(new Error(tr("Vidéo illisible")));
      });
      const clip: ClipInfo = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        url,
        duration: meta.duration,
        width: meta.videoWidth,
        height: meta.videoHeight,
        views,
        sourceUrl,
      };
      setClips((c) => [...c, clip]);
    },
    [],
  );


  const setRow = (id: string, patch: Partial<LinkRow>) =>
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const onLinkChange = (id: string, value: string) => {
    setRows((list) => {
      const next = list.map((r) =>
        r.id === id ? { ...r, url: value, status: "idle" as const, error: undefined } : r,
      );
      const last = next[next.length - 1];
      if (last && last.url.trim() !== "") next.push(newRow());
      return next;
    });
  };

  const queueRow = (id: string) => {
    setRows((list) =>
      list.map((r) =>
        r.id === id && r.url.trim() && (r.status === "idle" || r.status === "error")
          ? { ...r, status: "queued", error: undefined }
          : r,
      ),
    );
  };

  /**
   * Force un vrai téléchargement : les URLs signées du stockage sont
   * cross-origin, l'attribut `download` y est ignoré (le navigateur ouvre
   * la vidéo). On récupère donc le fichier puis on déclenche un blob local.
   */
  const downloadMontage = async (h: { id: string; url: string; ext: string }) => {
    let href = h.url;
    let revoke = false;
    try {
      const res = await fetch(h.url);
      if (res.ok) {
        href = URL.createObjectURL(await res.blob());
        revoke = true;
      }
    } catch {
      /* on retombe sur l'URL directe */
    }
    const a = document.createElement("a");
    a.href = href;
    a.download = `montage-${h.id}.${h.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (revoke) window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
  };

  // Sequential downloader: picks up queued links one after another.

  useEffect(() => {
    if (queueRef.current) return;
    const next = rows.find((r) => r.status === "queued");
    if (!next) return;
    queueRef.current = true;
    setLoading(true);
    void (async () => {
      setRow(next.id, { status: "loading" });
      try {
        const info = await resolveTikTok({ data: { url: next.url.trim() } });
        const res = await fetch(`/api/public/media-proxy?url=${encodeURIComponent(info.playUrl)}`);
        if (!res.ok) throw new Error(tr("Téléchargement impossible"));
        const blob = await res.blob();
        await addFromUrl(
          URL.createObjectURL(blob),
          info.title.slice(0, 60) || "Clip TikTok",
          info.views,
          next.url.trim(),
        );

        setRow(next.id, { status: "done" });
      } catch (e) {
        setRow(next.id, {
          status: "error",
          error:
            (e as Error).message ||
            tr("Ce lien n'a pas pu être récupéré. Importez la vidéo manuellement."),
        });
      } finally {
        queueRef.current = false;
        setLoading(false);
      }
    })();
  }, [rows, addFromUrl]);

  // Auto-queue a link shortly after it is pasted/typed.
  useEffect(() => {
    const pending = rows.filter((r) => r.status === "idle" && /tiktok\.com\//i.test(r.url));
    if (pending.length === 0) return;
    const t = setTimeout(() => pending.forEach((r) => queueRow(r.id)), 700);
    return () => clearTimeout(t);
  }, [rows]);

  const onFiles = async (files: FileList) => {
    for (const f of Array.from(files)) {
      try {
        await addFromUrl(URL.createObjectURL(f), f.name);
      } catch {
        setError(`Fichier illisible : ${f.name}`);
      }
    }
  };

  const removeClip = (id: string) => {
    for (const key of Array.from(videosRef.current.keys())) {
      if (key.startsWith(`${id}#`)) videosRef.current.delete(key);
    }
    setClips((c) => c.filter((x) => x.id !== id));
  };

  /** Relance la récupération d'un clip en cherchant une version HD. */
  const retryHd = async (clip: ClipInfo) => {
    setHdMenu(null);
    if (!clip.sourceUrl) return;
    setHdStatus((s) => ({ ...s, [clip.id]: { busy: true } }));
    try {
      const info = await resolveTikTok({ data: { url: clip.sourceUrl, hdOnly: true } });
      const res = await fetch(`/api/public/media-proxy?url=${encodeURIComponent(info.playUrl)}`);
      if (!res.ok) throw new Error(tr("Téléchargement HD impossible"));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const meta = document.createElement("video");
      meta.src = url;
      meta.muted = true;
      await new Promise<void>((ok, ko) => {
        meta.onloadedmetadata = () => ok();
        meta.onerror = () => ko(new Error(tr("Vidéo HD illisible")));
      });
      const better =
        Math.min(meta.videoWidth, meta.videoHeight) >
        Math.min(clip.width ?? 0, clip.height ?? 0);
      if (!better && !isHd({ width: meta.videoWidth, height: meta.videoHeight })) {
        URL.revokeObjectURL(url);
        throw new Error(tr("La qualité HD n'a pas pu être récupérée."));
      }
      for (const key of Array.from(videosRef.current.keys())) {
        if (key.startsWith(`${clip.id}#`)) videosRef.current.delete(key);
      }
      setClips((list) =>
        list.map((c) =>
          c.id === clip.id
            ? {
                ...c,
                url,
                width: meta.videoWidth,
                height: meta.videoHeight,
                duration: meta.duration || c.duration,
              }
            : c,
        ),
      );
      setHdStatus((s) => ({ ...s, [clip.id]: { busy: false } }));
    } catch (e) {
      setHdStatus((s) => ({
        ...s,
        [clip.id]: {
          busy: false,
          message: (e as Error).message || tr("La qualité HD n'a pas pu être récupérée."),
        },
      }));
    }
  };



  /** Étape 3 : import de la voix off, avec ou sans suppression des blancs. */
  const onAudioFile = async (file: File) => {
    setAudioBusy(true);
    setError(null);
    setAudioInfo(null);
    try {
      if (!trimBlanks) {
        const url = URL.createObjectURL(file);
        const el = document.createElement("audio");
        el.preload = "metadata";
        el.src = url;
        const duration = await new Promise<number>((res) => {
          el.onloadedmetadata = () => res(el.duration);
          el.onerror = () => res(0);
        });
        setVoiceover({ url, duration, name: file.name });
        setAudioInfo(`${tr("Audio ajouté tel quel")} · ${formatTime(duration)}`);
        return;
      }
      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
      await ctx.close();
      const target = targetMin * 60 + targetSec;
      const res = trimToTarget(decoded, {
        minSilence: range[0],
        maxSilence: range[1],
        targetDuration: target,
        thresholdDb: threshold,
      });
      const url = URL.createObjectURL(encodeWav(res.buffer));
      setVoiceover({ url, duration: res.buffer.duration, name: file.name });
      const found = detectSilences(decoded, threshold).length;
      setAudioInfo(
        `${res.removedCount} ${tr("blanc(s) supprimé(s) sur")} ${found} ${tr("détecté(s)")} · ${formatTime(
          decoded.duration,
        )} → ${formatTime(res.buffer.duration)}${
          res.reachedTarget ? "" : ` · ${tr("durée cible non atteinte")}`
        }`,
      );
    } catch {
      setError(tr("Impossible de lire ce fichier audio. Essayez un MP3 ou un WAV."));
    } finally {
      setAudioBusy(false);
    }
  };

  /** Play the whole timeline, drawing every frame into the canvas — hard cuts, no freeze. */
  const runTimeline = useCallback(
    async (
      onDone?: () => void,
      onReady?: () => void | Promise<void>,
      audioEl?: HTMLAudioElement | null,
    ) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || timeline.length === 0) return;
      abortRef.current = false;
      const rate = Math.min(4, Math.max(0.25, fxRef.current.speed));

      /** Seek a clip and wait for its first frame to be decoded, without playing it. */
      const prepare = async (segIndex: number, slot: number) => {
        const seg = timeline[segIndex];
        if (!seg) return null;
        const clip = orderedClips[seg.clip];
        if (!clip) return null;
        const v = getVideo(clip, slot);
        v.pause();
        v.playbackRate = rate;
        const target = Math.max(
          0,
          Math.min(seg.start, Math.max(0, clip.duration - 0.1)),
        );
        await new Promise<void>((res) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            v.removeEventListener("seeked", finish);
            v.removeEventListener("loadeddata", finish);
            res();
          };
          const timer = setTimeout(finish, 2000);
          v.addEventListener("seeked", finish);
          v.addEventListener("loadeddata", finish);
          try {
            v.currentTime = target;
          } catch {
            finish();
          }
          if (v.readyState >= 2 && Math.abs(v.currentTime - target) < 0.02) finish();
        });
        return v;
      };

      let elapsed = 0;
      const prepared = new Map<number, Promise<HTMLVideoElement | null>>();
      const queuePrepare = (index: number) => {
        if (index >= timeline.length) return;
        if (!prepared.has(index)) prepared.set(index, prepare(index, index % 3));
      };

      // Decode the first three cuts before starting the voice-over. Short intro
      // segments can then switch instantly even on slower devices.
      for (let i = 0; i < Math.min(3, timeline.length); i++) queuePrepare(i);
      await Promise.all(prepared.values());
      onReady && (await onReady());

      // The voice-over is the master clock: the montage ends exactly with it.
      const runStart = performance.now();
      const endsAt = () => {
        if (audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
          return audioEl.duration;
        }
        return totalDuration;
      };
      const globalElapsed = () =>
        audioEl && !audioEl.paused ? audioEl.currentTime : (performance.now() - runStart) / 1000;
      const voiceOver = () =>
        (audioEl?.ended ?? false) || globalElapsed() >= endsAt() - 0.02;

      for (let i = 0; i < timeline.length; i++) {
        if (abortRef.current || voiceOver()) break;
        const seg = timeline[i]!;
        queuePrepare(i);
        queuePrepare(i + 1);
        queuePrepare(i + 2);
        const v = await prepared.get(i);
        if (!v) {
          elapsed += seg.duration;
          continue;
        }
        // The decoded first frame is painted before playback begins: the cut
        // never keeps the outgoing clip's last frame on screen.
        // Effet de coupure (hook ou effet mélangé) calculé pendant le rendu :
        // il est donc présent aussi bien en prévisualisation que dans le MP4.
        const effect = effectForSegment(i, hookRef.current);
        drawFrame(ctx, v, fxRef.current, frameFxAt(effect, 0));
        await v.play().catch(() => {});

        await new Promise<void>((res) => {
          const started = performance.now();
          const tick = () => {
            if (abortRef.current || voiceOver()) return res();
            const local = (performance.now() - started) / 1000;
            drawFrame(ctx, v, fxRef.current, frameFxAt(effect, local));
            const t = (performance.now() - started) / 1000;
            setProgress(Math.min(1, (elapsed + t) / Math.max(0.1, totalDuration)));
            if (t >= seg.duration) return res();
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });

        elapsed += seg.duration;
        v.pause();
        prepared.delete(i);
      }

      videosRef.current.forEach((v) => v.pause());
      onDone?.();
    },
    [orderedClips, getVideo, timeline, totalDuration],
  );

  /**
   * Démarre la musique de fond en même temps que la voix off. Le fondu de sortie
   * est programmé pour se terminer pile à la fin de la voix (2 min maximum), donc
   * la musique ne prolonge jamais la vidéo.
   */
  const startMusic = (
    el: HTMLAudioElement | null,
    setGain: (v: number) => void,
    now: () => number,
  ) => {
    if (!el || !music) return () => {};
    const peak = dbToGain(musicGainDb);
    setGain(peak);
    el.currentTime = 0;
    void el.play().catch(() => {});

    let stopped = false;
    let fade = 0;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      window.clearTimeout(scheduled);
      const start = now();
      fade = window.setInterval(() => {
        const k = Math.max(0, 1 - (now() - start) / MUSIC_FADE_SECONDS);
        setGain(peak * k);
        if (k <= 0) {
          window.clearInterval(fade);
          el.pause();
        }
      }, 40);
    };

    // Fin prévue : la voix off, plafonnée à 2 minutes.
    const endsAt = Math.min(MUSIC_MAX_SECONDS, totalDuration || MUSIC_MAX_SECONDS);
    const scheduled = window.setTimeout(
      stop,
      Math.max(0, endsAt - MUSIC_FADE_SECONDS) * 1000,
    );

    return () => {
      window.clearTimeout(scheduled);
      if (!stopped) {
        stopped = true;
        setGain(0);
        el.pause();
      } else {
        window.clearInterval(fade);
        setGain(0);
        el.pause();
      }
    };
  };


  const preview = async () => {
    if (playing) {
      abortRef.current = true;
      setPlaying(false);
      audioRef.current?.pause();
      musicRef.current?.pause();
      return;
    }
    setPlaying(true);
    let stopMusic = () => {};
    await runTimeline(
      () => {
        setPlaying(false);
        audioRef.current?.pause();
        stopMusic();
      },
      async () => {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          await audioRef.current.play();
        }
        stopMusic = startMusic(
          musicRef.current,
          (v) => {
            if (musicRef.current) musicRef.current.volume = Math.min(1, Math.max(0, v));
          },
          () => performance.now() / 1000,
        );
      },
      audioRef.current,
    );
  };

  const generate = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !voice || timeline.length === 0) return;
    if (!userId) {
      setError(tr("Connectez-vous pour générer une vidéo (10 crédits offerts à l'inscription)."));
      return;
    }
    setRendering(true);
    setError(null);
    // Débit des crédits avant l'export ; remboursés si la génération échoue.
    let debit: { fromMonthly: number; fromPurchased: number } | null = null;
    try {
      const r = await consume();
      if (!r.ok) {
        setError(tr("Plus de crédits : rechargez ou abonnez-vous pour générer cette vidéo."));
        setRendering(false);
        return;
      }
      debit = { fromMonthly: r.fromMonthly, fromPurchased: r.fromPurchased };
      void invalidateBilling();
    } catch (e) {
      setError((e as Error).message || tr("La génération a échoué."));
      setRendering(false);
      return;
    }
    try {
      const stream = canvas.captureStream(30);
      const audio = new Audio(voice.url);
      audio.crossOrigin = "anonymous";
      const actx = new AudioContext();
      const src = actx.createMediaElementSource(audio);
      const dest = actx.createMediaStreamDestination();
      src.connect(dest);

      // Musique de fond mixée sous la voix via un GainNode (dB → gain linéaire).
      let musicEl: HTMLAudioElement | null = null;
      let musicGain: GainNode | null = null;
      if (music) {
        musicEl = new Audio(music.url);
        musicEl.crossOrigin = "anonymous";
        musicEl.loop = false;
        musicGain = actx.createGain();
        musicGain.gain.value = dbToGain(musicGainDb);
        actx.createMediaElementSource(musicEl).connect(musicGain);
        musicGain.connect(dest);
      }

      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

      const { mime, ext } = pickRecordingType();
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const done = new Promise<Blob>((res) => {
        rec.onstop = () => res(new Blob(chunks, { type: ext === "mp4" ? "video/mp4" : "video/webm" }));
      });

      rec.start(200);
      let stopMusic = () => {};
      await runTimeline(
        undefined,
        async () => {
          audio.currentTime = 0;
          await audio.play();
          stopMusic = startMusic(
            musicEl,
            (v) => {
              if (musicGain) musicGain.gain.value = v;
            },
            () => actx.currentTime,
          );
        },
        audio,
      );
      audio.pause();
      // La musique est déjà en fin de fondu : elle se coupe avec la voix.
      stopMusic();
      // Cut the recording on the exact frame the voice ends.
      rec.stop();
      await actx.close();


      const blob = await done;
      const now = Date.now();
      if (userId) {
        await uploadMontage(userId, blob, {
          duration: totalDuration,
          mime: blob.type,
          ext,
        }).catch(() => {});
        await refreshHistory();
      } else {
        const entry = {
          id: `${now}`,
          createdAt: now,
          expiresAt: now + RETENTION_MS,
          duration: totalDuration,
          mime: blob.type,
          ext,
          blob,
        };
        await saveLocalMontage(entry).catch(() => {});
        setHistory((h) => [{ ...entry, url: URL.createObjectURL(blob) }, ...h]);
      }
      setTab("history");
    } catch (e) {
      setError((e as Error).message || tr("La génération a échoué."));
      if (debit) {
        await refund({ data: debit }).catch(() => {});
        void invalidateBilling();
      }
    } finally {
      setRendering(false);
      setProgress(0);
    }
  };

  const busy = loading || rendering;
  // L'étape musique est facultative ; les clips et la voix off restent requis.
  const canNext =
    step === 0 ? clips.length > 0 : step === 3 ? !!voice && !measuring : !isLastStep;


  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-14">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-primary">
          {tr("Montage vertical")}
        </p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{tr("Clips TikTok + voix off")}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          {session === undefined ? null : userId ? (
            <span className="flex items-center gap-3 text-muted-foreground">
              <span>
                {tr("Connecté")}&nbsp;: <strong className="text-foreground">{session?.user.email}</strong>
              </span>
              {savedAt && <span className="text-primary">{tr("Réglages sauvegardés ✓")}</span>}
              <button
                className="text-destructive hover:underline"
                onClick={() => void supabase.auth.signOut()}
              >
                {tr("Se déconnecter")}
              </button>
            </span>
          ) : (
            <Link to="/auth" className="text-primary underline">
              {tr("Se connecter pour sauvegarder réglages, presets et historique")}
            </Link>
          )}
        </div>
      </header>

      <div className="mb-8 inline-flex rounded-full bg-secondary/60 p-1">
        {(["editor", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition ${
              tab === t ? "gradient-brand text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t === "editor" ? tr("Montage") : `${tr("Historique")} (${history.length})`}
          </button>
        ))}
      </div>

      {tab === "history" ? (
        <section className="panel-glow space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            {userId
              ? tr("Les vidéos générées restent disponibles 5 heures sur votre compte, depuis n'importe quel appareil.")
              : tr("Les vidéos générées restent disponibles 5 heures sur cet appareil. Connectez-vous pour lier votre historique à votre compte.")}
          </p>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tr("Aucune vidéo pour l'instant.")}</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {history.map((h) => (
                <div key={h.id} className="space-y-2">
                  <video src={h.url} controls className="w-full rounded-xl bg-black" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {new Date(h.createdAt).toLocaleString(locale)} · {formatTime(h.duration)}
                    </span>
                    <span>
                      {remainingLabel(h.expiresAt).replace("restantes", tr("restantes"))}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <button
                      onClick={() => void downloadMontage(h)}
                      className="text-primary underline"
                    >
                      {tr("Télécharger le")} {h.ext.toUpperCase()}
                    </button>

                    <button
                      onClick={() => {
                        if (h.storagePath) {
                          void deleteCloudMontage({ id: h.id, storagePath: h.storagePath });
                        } else {
                          void deleteLocalMontage(h.id);
                        }
                        setHistory((list) => list.filter((x) => x.id !== h.id));
                      }}
                      className="text-destructive hover:underline"
                    >
                      {tr("Supprimer")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-6">
          {/* Fil d'étapes */}
          <ol className="flex flex-wrap items-center gap-2 text-sm">
            {visibleSteps.map((id, i) => (
              <li key={id} className="flex items-center gap-2">
                <button
                  onClick={() => i <= stepPos && setStep(id)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 transition ${
                    id === step
                      ? "gradient-brand text-primary-foreground"
                      : i < stepPos
                        ? "bg-secondary/60 text-foreground"
                        : "bg-secondary/30 text-muted-foreground"
                  }`}
                >
                  <span className="font-mono text-xs">{i + 1}</span>
                  {tr(STEPS[id]!)}
                </button>
                {i < visibleSteps.length - 1 && (
                  <span className="text-muted-foreground/50">→</span>
                )}
              </li>
            ))}
          </ol>


          {/* Étape 1 — Clips */}
          {step === 0 && (
            <section className="panel-glow p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <h2 className="text-2xl font-semibold">{tr("Ajoutez vos clips")}</h2>
                <label className="flex items-center gap-2 rounded-full bg-secondary/50 px-4 py-2 text-sm">
                  <span>{tr("Options avancées")}</span>
                  <Switch checked={advanced} onCheckedChange={setAdvanced} />
                </label>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {tr("Collez vos liens TikTok à la suite : chaque lien libère automatiquement le champ suivant et se télécharge en HD au fur et à mesure.")}
              </p>

              <div className="mt-6 space-y-3">
                {rows.map((r, i) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-3">
                    <span className="w-6 text-sm text-muted-foreground">{i + 1}.</span>
                    <Input
                      placeholder="https://www.tiktok.com/@user/video/…"
                      value={r.url}
                      onChange={(e) => onLinkChange(r.id, e.target.value)}
                      onBlur={() => queueRow(r.id)}
                      onKeyDown={(e) => e.key === "Enter" && queueRow(r.id)}
                      disabled={r.status === "loading" || r.status === "done"}
                      className="min-w-[240px] flex-1"
                    />
                    <span className="w-28 text-xs">
                      {r.status === "loading" && (
                        <span className="text-primary">{tr("Téléchargement…")}</span>
                      )}
                      {r.status === "queued" && (
                        <span className="text-muted-foreground">{tr("En attente…")}</span>
                      )}
                      {r.status === "done" && <span className="text-primary">{tr("Prêt ✓")}</span>}
                      {r.status === "error" && (
                        <button
                          onClick={() => queueRow(r.id)}
                          className="text-destructive hover:underline"
                        >
                          {tr("Réessayer")}
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && void onFiles(e.target.files)}
                />
                <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
                  {tr("Importer un fichier")}
                </Button>
              </div>
              {rows.some((r) => r.error) && (
                <p className="mt-2 text-xs text-destructive">{rows.find((r) => r.error)?.error}</p>
              )}

              <ul className="mt-6 space-y-2">
                {orderedClips.map((c, i) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 px-4 py-3 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <strong className="shrink-0 text-primary">#{i + 1}</strong>
                      {i < 3 && (
                        <span
                          className="shrink-0 rounded-full bg-accent/25 px-2 py-0.5 text-[11px] font-semibold text-accent-foreground"
                          title={tr("Fait partie des 3 clips les plus vus — utilisé dans l'intro")}
                        >
                          {tr("Top")}
                        </span>
                      )}
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="flex items-center gap-3 text-muted-foreground">
                      {c.views != null && (
                        <span title={`${c.views.toLocaleString(locale)} ${tr("vues")}`}>
                          {formatViews(c.views)} {tr("vues")}
                        </span>
                      )}
                      {isHd(c) ? (
                        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          HD
                        </span>
                      ) : (
                        <span className="relative">
                          <button
                            type="button"
                            disabled={hdStatus[c.id]?.busy}
                            onClick={() => setHdMenu((m) => (m === c.id ? null : c.id))}
                            title={tr("Qualité SD — cliquez pour tenter une récupération en HD")}
                            className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted/70 disabled:opacity-60"
                          >
                            {hdStatus[c.id]?.busy ? "SD…" : "SD ▾"}
                          </button>
                          {hdMenu === c.id && (
                            <span className="absolute right-0 z-20 mt-1 flex w-56 flex-col rounded-xl border border-border bg-popover p-1 text-left shadow-lg">
                              <button
                                type="button"
                                disabled={!c.sourceUrl}
                                onClick={() => void retryHd(c)}
                                className="rounded-lg px-3 py-2 text-left text-xs text-popover-foreground hover:bg-secondary disabled:opacity-50"
                              >
                                {c.sourceUrl
                                  ? tr("Tenter de récupérer en HD")
                                  : tr("Indisponible (import manuel)")}
                              </button>
                            </span>
                          )}
                          {hdStatus[c.id]?.message && (
                            <span className="absolute right-0 top-full z-10 mt-1 w-56 text-right text-[11px] text-destructive">
                              {hdStatus[c.id]?.message}
                            </span>
                          )}
                        </span>
                      )}

                      {formatTime(c.duration)}
                      <button
                        onClick={() => removeClip(c.id)}
                        className="text-destructive hover:underline"
                      >
                        {tr("Retirer")}
                      </button>
                    </span>
                  </li>
                ))}
                {clips.length === 0 && (
                  <li className="text-sm text-muted-foreground">{tr("Aucun clip pour l'instant.")}</li>
                )}
              </ul>
            </section>
          )}

          {/* Étape 2 — Durées & effets */}
          {step === 1 && (
            <section className="panel-glow space-y-8 p-6 sm:p-8">
              <div>
                <h2 className="text-2xl font-semibold">{tr("Durées et effets")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tr("Réglez l'intro (3 clips les plus vus) puis les effets appliqués à tout le montage.")}
                </p>
              </div>

              <div className="space-y-7">
                {[0, 1, 2].map((i) => (
                  <Range
                    key={i}
                    label={tr("Durée du clip") + ` #${i + 1} ` + tr("dans l'intro")}
                    value={intros[i] ?? 0}
                    min={0}
                    max={3}
                    step={0.1}
                    unit=" s"
                    onChange={(v) => setIntroAt(i, v)}
                  />
                ))}
                <p className="-mt-4 text-xs text-muted-foreground">
                  {tr("Intro totale")} : {intros.reduce((a, b) => a + b, 0).toFixed(1)} s
                </p>
              </div>

              <div className="space-y-7 border-t border-border pt-7">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mirror">{tr("Effet miroir")}</Label>
                  <Switch
                    id="mirror"
                    checked={fx.mirror}
                    onCheckedChange={(v) => setFx({ ...fx, mirror: v })}
                  />
                </div>
                <Range label={tr("Zoom / recadrage")} value={fx.zoom} min={90} max={120} step={1} unit="%"
                  onChange={(v) => setFx({ ...fx, zoom: v })} />
                <Range label={tr("Vitesse de lecture")} value={fx.speed} min={0.5} max={2} step={0.05} unit="×"
                  onChange={(v) => setFx({ ...fx, speed: v })} />
                <Range label={tr("Luminosité")} value={fx.brightness} min={50} max={150} step={1} unit="%"
                  onChange={(v) => setFx({ ...fx, brightness: v })} />
                <Range label={tr("Contraste")} value={fx.contrast} min={50} max={150} step={1} unit="%"
                  onChange={(v) => setFx({ ...fx, contrast: v })} />
                <Range label={tr("Saturation")} value={fx.saturation} min={0} max={200} step={1} unit="%"
                  onChange={(v) => setFx({ ...fx, saturation: v })} />
                <Range label={tr("Bande floue — haut")} value={fx.blurTop} min={0} max={35} step={1} unit="%"
                  onChange={(v) => setFx({ ...fx, blurTop: v })} />
                <Range label={tr("Bande floue — bas")} value={fx.blurBottom} min={0} max={35} step={1} unit="%"
                  onChange={(v) => setFx({ ...fx, blurBottom: v })} />
                <Range label={tr("Intensité du flou")} value={fx.blurIntensity} min={0} max={40} step={1} unit="px"
                  onChange={(v) => setFx({ ...fx, blurIntensity: v })} />
              </div>

              <div className="space-y-4 border-t border-border pt-7">
                <h3 className="text-lg font-semibold">{tr("Presets")}</h3>
                {!userId ? (
                  <p className="text-sm text-muted-foreground">
                    <Link to="/auth" className="text-primary underline">
                      {tr("Connectez-vous")}
                    </Link>{" "}
                    {tr("pour enregistrer vos presets et retrouver vos réglages automatiquement.")}
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {tr("Vos réglages sont sauvegardés automatiquement, même sans preset.")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {presets.length === 0 && (
                        <span className="text-sm text-muted-foreground">
                          {tr("Aucun preset enregistré.")}
                        </span>
                      )}
                      {presets.map((p) => (
                        <span
                          key={p.id}
                          className="flex items-center gap-2 rounded-full bg-secondary/60 px-3 py-2 text-sm"
                        >
                          <button
                            className="font-medium hover:text-primary"
                            onClick={() => setSettings(p.settings)}
                          >
                            {p.name}
                          </button>
                          <button
                            className="text-xs text-destructive hover:underline"
                            onClick={() => {
                              void deletePreset(p.id).then(() =>
                                setPresets((list) => list.filter((x) => x.id !== p.id)),
                              );
                            }}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Input
                        placeholder={tr("Nom du preset")}
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        className="min-w-[200px] flex-1"
                      />
                      <Button
                        variant="secondary"
                        disabled={!presetName.trim()}
                        onClick={() => {
                          const name = presetName.trim();
                          void upsertPreset(userId, name, settings)
                            .then(() => listPresets(userId))
                            .then((list) => {
                              setPresets(list);
                              setPresetName("");
                            })
                            .catch(() => setError(tr("Enregistrement du preset impossible.")));
                        }}
                      >
                        {tr("Enregistrer les réglages actuels")}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* Étape 3 — Hook & Effets */}
          {step === 2 && (
            <section className="panel-glow space-y-8 p-6 sm:p-8">
              <div>
                <h2 className="text-2xl font-semibold">{tr("Hook & Effets")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tr(
                    "Zoom dynamique au moment des coupures, appliqué pendant le rendu vidéo : ce que vous voyez ici se retrouve dans le MP4.",
                  )}
                </p>
              </div>

              <div className="space-y-7">
                <div className="flex items-center justify-between">
                  <Label htmlFor="hook-on">{tr("Zoom dynamique en intro (hook)")}</Label>
                  <Switch
                    id="hook-on"
                    checked={hook.hookEnabled}
                    onCheckedChange={(v) => setHook({ hookEnabled: v })}
                  />
                </div>
                {advanced && hook.hookEnabled && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {(["in", "out"] as const).map((d) => (
                        <Button
                          key={d}
                          size="sm"
                          variant={hook.hookDirection === d ? "default" : "secondary"}
                          onClick={() => setHook({ hookDirection: d })}
                        >
                          {d === "in" ? tr("Zoom avant") : tr("Zoom arrière")}
                        </Button>
                      ))}
                    </div>
                    <Range
                      label={tr("Vitesse de l'effet de zoom")}
                      value={hook.hookDuration}
                      min={0.1}
                      max={1}
                      step={0.05}
                      unit=" s"
                      onChange={(v) => setHook({ hookDuration: v })}
                    />
                    <Range
                      label={tr("Intensité du zoom")}
                      value={hook.hookIntensity}
                      min={5}
                      max={60}
                      step={1}
                      unit="%"
                      onChange={(v) => setHook({ hookIntensity: v })}
                    />
                    <EasingPicker
                      label={tr("Fluidité (easing)")}
                      value={hook.hookEasing}
                      onChange={(v) => setHook({ hookEasing: v })}
                      tr={tr}
                    />
                  </>
                )}
              </div>

              <div className="space-y-7 border-t border-border pt-7">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mixed-on">{tr("Effets mélangés")}</Label>
                  <Switch
                    id="mixed-on"
                    checked={hook.mixedEnabled}
                    onCheckedChange={(v) => setHook({ mixedEnabled: v })}
                  />
                </div>
                <p className="-mt-4 text-xs text-muted-foreground">
                  {tr("Le système alterne les effets cochés au fil des coupures.")}
                </p>
                {advanced && hook.mixedEnabled && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {MIXED_EFFECTS.map((name) => (
                        <Button
                          key={name}
                          size="sm"
                          variant={hook.mixedEffects.includes(name) ? "default" : "secondary"}
                          onClick={() => toggleMixedEffect(name)}
                        >
                          {tr(EFFECT_LABELS[name])}
                        </Button>
                      ))}
                    </div>
                    <Range
                      label={tr("Fréquence — un effet toutes les X coupures")}
                      value={hook.mixedEveryCuts}
                      min={1}
                      max={8}
                      step={1}
                      unit=""
                      onChange={(v) => setHook({ mixedEveryCuts: Math.round(v) })}
                    />
                    <Range
                      label={tr("Durée de l'effet")}
                      value={hook.mixedDuration}
                      min={0.2}
                      max={2}
                      step={0.05}
                      unit=" s"
                      onChange={(v) => setHook({ mixedDuration: v })}
                    />
                    <Range
                      label={tr("Intensité des effets")}
                      value={hook.mixedIntensity}
                      min={5}
                      max={60}
                      step={1}
                      unit="%"
                      onChange={(v) => setHook({ mixedIntensity: v })}
                    />
                    <EasingPicker
                      label={tr("Fluidité (easing)")}
                      value={hook.mixedEasing}
                      onChange={(v) => setHook({ mixedEasing: v })}
                      tr={tr}
                    />
                  </>
                )}
              </div>
            </section>
          )}

          {/* Étape 4 — Voix off */}

          {step === 3 && (
            <section className="panel-glow space-y-6 p-6 sm:p-8">
              <div>
                <h2 className="text-2xl font-semibold">{tr("Voix off / Audio")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tr("Choisissez comment votre audio doit être intégré au montage.")}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    key: false,
                    title: tr("Ajouter l'audio"),
                    desc: tr("L'audio est utilisé tel quel, sans modification."),
                  },
                  {
                    key: true,
                    title: tr("Ajouter l'audio et supprimer les blancs"),
                    desc: tr("Les silences sont coupés jusqu'à la durée cible choisie."),
                  },
                ].map((opt) => (
                  <button
                    key={String(opt.key)}
                    onClick={() => setTrimBlanks(opt.key)}
                    className={`rounded-2xl border p-5 text-left transition ${
                      trimBlanks === opt.key
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary/40 hover:bg-secondary/60"
                    }`}
                  >
                    <p className="font-semibold">{opt.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {advanced && trimBlanks && (
                <div className="space-y-7 rounded-2xl bg-secondary/40 p-5">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label>{tr("Intervalle des blancs à supprimer")}</Label>
                      <span className="font-mono text-sm text-primary">
                        {range[0].toFixed(2)} s → {range[1].toFixed(2)} s
                      </span>
                    </div>
                    <Slider
                      className="mt-4"
                      min={0.05}
                      max={2}
                      step={0.05}
                      value={range}
                      onValueChange={(v) => setRange([v[0]!, v[1]!] as [number, number])}
                    />
                  </div>
                  <Range
                    label={tr("Sensibilité de détection")}
                    value={threshold}
                    min={-70}
                    max={-20}
                    step={1}
                    unit=" dB"
                    onChange={setThreshold}
                  />
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <Label htmlFor="min">{tr("Durée cible — minutes")}</Label>
                      <Input
                        id="min"
                        type="number"
                        min={0}
                        className="mt-2 w-28"
                        value={targetMin}
                        onChange={(e) => setTargetMin(Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sec">{tr("Secondes")}</Label>
                      <Input
                        id="sec"
                        type="number"
                        min={0}
                        max={59}
                        className="mt-2 w-28"
                        value={targetSec}
                        onChange={(e) => setTargetSec(Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                    <p className="pb-2 text-sm text-muted-foreground">
                      {tr("Cible")}&nbsp;:{" "}
                      <strong className="text-foreground">
                        {formatTime(targetMin * 60 + targetSec)}
                      </strong>
                    </p>
                  </div>
                </div>
              )}

              <input
                ref={audioFileRef}
                type="file"
                accept="audio/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onAudioFile(f);
                  e.target.value = "";
                }}
              />
              <Button size="lg" onClick={() => audioFileRef.current?.click()} disabled={audioBusy}>
                {audioBusy ? tr("Traitement…") : tr("Choisir le fichier audio")}
              </Button>

              {voice && (
                <div className="space-y-2 rounded-2xl bg-secondary/40 p-5 text-sm">
                  <p>
                    {tr("Voix off")}&nbsp;:{" "}
                    <strong className="text-foreground">
                      {voice.name} · {measuring ? tr("mesure…") : formatTime(totalDuration)}
                    </strong>
                  </p>
                  {audioInfo && <p className="text-primary">{audioInfo}</p>}
                  <audio controls src={voice.url} className="w-full" />
                </div>
              )}
            </section>
          )}

          {/* Étape 4 — Musique de fond */}
          {step === 4 && (
            <section className="panel-glow space-y-6 p-6 sm:p-8">
              <div>
                <h2 className="text-2xl font-semibold">{tr("Musique de fond")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tr(
                    "Facultatif. La musique démarre avec la voix off et se coupe toujours à sa fin (2 minutes maximum).",
                  )}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <button
                  onClick={() => chooseMusic(null)}
                  className={`rounded-2xl border p-5 text-left transition ${
                    !music
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/40 hover:bg-secondary/60"
                  }`}
                >
                  <p className="font-semibold">{tr("Aucune musique")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tr("Seule la voix off est présente dans la vidéo.")}
                  </p>
                </button>

                <button
                  onClick={() => chooseMusic(BUILTIN_MUSIC)}
                  className={`rounded-2xl border p-5 text-left transition ${
                    music?.builtin
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/40 hover:bg-secondary/60"
                  }`}
                >
                  <p className="font-semibold">{BUILTIN_MUSIC.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tr("Piste incluse, ambiance mystérieuse · 2 min maximum")}
                  </p>
                </button>

                {billing.can.importMusic ? (
                  <button
                    onClick={() => musicFileRef.current?.click()}
                    className={`rounded-2xl border p-5 text-left transition ${
                      music && !music.builtin
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary/40 hover:bg-secondary/60"
                    }`}
                  >
                    <p className="font-semibold">{tr("Importer ma musique")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {music && !music.builtin
                        ? music.name
                        : tr("Choisir un fichier audio depuis mon ordinateur (MP3, WAV…).")}
                    </p>
                  </button>
                ) : (
                  <Link
                    to="/pricing"
                    className="rounded-2xl border border-border bg-secondary/20 p-5 text-left opacity-70 transition hover:opacity-100"
                  >
                    <p className="flex items-center gap-2 font-semibold">
                      {tr("Importer ma musique")}
                      <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                        <Lock className="size-3" /> Pro
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tr("Disponible avec les formules Pro et Elite.")}
                    </p>
                  </Link>
                )}
              </div>

              <input
                ref={musicFileRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    chooseMusic({ url: URL.createObjectURL(f), name: f.name, builtin: false });
                  }
                  e.target.value = "";
                }}
              />

              {music && (
                <div className="space-y-5 rounded-2xl bg-secondary/40 p-5">
                  {advanced && (
                    <>
                      <Range
                        label={tr("Volume de la musique")}
                        value={musicGainDb}
                        min={-40}
                        max={0}
                        step={1}
                        unit=" dB"
                        onChange={setMusicGainDb}
                      />
                      <p className="text-xs text-muted-foreground">
                        {tr("Réglage d'origine : −30 dB, très en retrait derrière la voix.")}
                      </p>
                    </>
                  )}
                  <audio controls src={music.url} className="w-full" />
                </div>
              )}
            </section>
          )}

          {/* Étape 5 — Prévisualisation */}
          {step === 5 && (
            <section className="panel-glow grid gap-8 p-6 sm:p-8 lg:grid-cols-[360px_minmax(0,1fr)]">
              <div>
                <canvas
                  ref={canvasRef}
                  width={W}
                  height={H}
                  className="w-full rounded-2xl bg-black"
                />
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="gradient-brand h-full transition-[width]"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                {voice && <audio ref={audioRef} src={voice.url} className="hidden" />}
                {music && (
                  <audio ref={musicRef} src={music.url} crossOrigin="anonymous" className="hidden" />
                )}
              </div>

              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">{tr("Prévisualisation")}</h2>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    {tr("Clips")}&nbsp;: <strong className="text-foreground">{clips.length}</strong>
                  </p>
                  <p>
                    {tr("Voix off")}&nbsp;:{" "}
                    <strong className="text-foreground">
                      {voice
                        ? `${voice.name} · ${measuring ? tr("mesure…") : formatTime(totalDuration)}`
                        : tr("aucune")}
                    </strong>
                  </p>
                  <p>
                    {tr("Musique de fond")}&nbsp;:{" "}
                    <strong className="text-foreground">
                      {music
                        ? advanced
                          ? `${music.name} · ${musicGainDb} dB`
                          : music.name
                        : tr("aucune")}
                    </strong>
                  </p>
                  <p>
                    {tr("Montage final")}&nbsp;:{" "}
                    <strong className="text-foreground">
                      {timeline.length} {tr("séquences")} · {formatTime(timelineDuration)}
                    </strong>
                  </p>
                  {voice && !measuring && timeline.length > 0 && (
                    <p className="text-xs text-primary">
                      {Math.abs(timelineDuration - totalDuration) < 0.05
                        ? tr("Durée calée exactement sur la voix off.")
                        : `${tr("Écart de")} ${(timelineDuration - totalDuration).toFixed(2)} s`}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:max-w-xs">
                  <Button
                    variant="secondary"
                    onClick={() => void preview()}
                    disabled={!voice || measuring || clips.length === 0 || rendering}
                  >
                    {measuring
                      ? tr("Analyse de la voix off…")
                      : playing
                        ? tr("Arrêter")
                        : tr("Prévisualiser")}
                  </Button>
                  {noCredits ? (
                    <Button size="lg" asChild>
                      <Link to="/pricing">
                        <Lock className="size-4" /> {tr("Plus de crédits — recharger")}
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      onClick={() => void generate()}
                      disabled={!voice || measuring || clips.length === 0 || busy || playing}
                    >
                      {rendering ? tr("Génération…") : tr("Générer la vidéo")}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {tr("La vidéo générée est ajoutée automatiquement à l'historique.")}
                    {billing.signedIn && !billing.loading && (
                      <>
                        {" "}
                        · {CREDITS_PER_VIDEO} {tr("crédits par vidéo")} ·{" "}
                        {tr("solde")}&nbsp;: {billing.totalCredits}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </section>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-between gap-4">
            <Button
              variant="secondary"
              onClick={() => setStep(visibleSteps[Math.max(0, stepPos - 1)]!)}
              disabled={stepPos === 0}
            >
              {tr("← Précédent")}
            </Button>
            {!isLastStep && (
              <Button
                size="lg"
                onClick={() => setStep(visibleSteps[stepPos + 1]!)}
                disabled={!canNext}
              >
                {tr("Suivant →")}
              </Button>
            )}
          </div>

        </div>
      )}
    </main>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="font-mono text-sm text-primary">
          {step < 1 ? value.toFixed(2) : value}
          {unit}
        </span>
      </div>
      <Slider
        className="mt-3"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0]!)}
      />
    </div>
  );
}
