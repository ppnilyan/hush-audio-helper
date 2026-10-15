import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Scissors,
  Undo2,
  Volume2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  drawFrame,
  effectForSegment,
  frameFxAt,
  type ClipInfo,
  type Effects,
  type HookSettings,
  type Segment,
} from "@/lib/montage";
import { moveSequence, resizeBoundary, sequenceAt, splitSequence } from "@/lib/timeline-editor";

type Props = {
  clips: ClipInfo[];
  segments: Segment[];
  voiceUrl: string;
  duration: number;
  rate: number;
  fx: Effects;
  hook: HookSettings;
  voiceGain: number;
  onChange: (segments: Segment[]) => void;
  onReset: () => void;
};

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toFixed(2).padStart(5, "0")}`;

export function TimelineEditor({
  clips,
  segments,
  voiceUrl,
  duration,
  rate,
  fx,
  hook,
  voiceGain,
  onChange,
  onReset,
}: Props) {
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(28);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [past, setPast] = useState<Segment[][]>([]);
  const [future, setFuture] = useState<Segment[][]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const gainRef = useRef<{ context: AudioContext; gain: GainNode } | null>(null);
  const gesture = useRef<{
    kind: "move" | "resize";
    index: number;
    x: number;
    original: Segment[];
  } | null>(null);
  const current = sequenceAt(segments, cursor * rate);
  const activeClip = current && clips[current.segment.clip];
  const selectedSegment = segments[selected];
  const selectedClip = selectedSegment && clips[selectedSegment.clip];
  const selectedStart =
    segments.slice(0, selected).reduce((sum, segment) => sum + segment.duration, 0) / rate;
  const splitOffset = (cursor - selectedStart) * rate;
  const canSplit =
    !!selectedSegment && splitOffset >= 0.1 && selectedSegment.duration - splitOffset >= 0.1;

  const stop = () => {
    audioRef.current?.pause();
    videoRef.current?.pause();
    setPlaying(false);
  };
  const commit = (next: Segment[]) => {
    stop();
    if (next === segments) return;
    setPast((items) => [...items.slice(-39), segments]);
    setFuture([]);
    onChange(next);
  };
  const seek = (time: number) => {
    const next = Math.max(0, Math.min(duration, time));
    setCursor(next);
    if (audioRef.current) audioRef.current.currentTime = next;
  };

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const context = new AudioContext();
    void fetch(voiceUrl, { signal: controller.signal })
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        if (!alive) return;
        const data = buffer.getChannelData(0);
        const count = 700;
        const size = Math.max(1, Math.floor(data.length / count));
        const peaks = Array.from({ length: count }, (_, index) => {
          let peak = 0;
          for (let i = index * size; i < Math.min(data.length, (index + 1) * size); i += 8)
            peak = Math.max(peak, Math.abs(data[i] ?? 0));
          return peak;
        });
        const max = Math.max(0.01, ...peaks);
        setWaveform(peaks.map((peak) => peak / max));
      })
      .catch(() => {
        if (alive) setWaveform([]);
      })
      .finally(() => void context.close());
    return () => {
      alive = false;
      controller.abort();
    };
  }, [voiceUrl]);

  useEffect(() => {
    let alive = true;
    const videos: HTMLVideoElement[] = [];
    for (const clip of clips) {
      const video = document.createElement("video");
      videos.push(video);
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.preload = "metadata";
      video.onloadeddata = () => {
        if (!alive) return;
        const canvas = document.createElement("canvas");
        canvas.width = 90;
        canvas.height = 160;
        const context = canvas.getContext("2d");
        if (!context) return;
        try {
          context.drawImage(video, 0, 0, 90, 160);
          const image = canvas.toDataURL("image/jpeg", 0.65);
          setThumbnails((previous) => ({ ...previous, [clip.id]: image }));
        } catch {
          /* CORS may prevent thumbnails, not playback. */
        }
      };
      video.src = clip.url;
    }
    return () => {
      alive = false;
      videos.forEach((video) => {
        video.src = "";
      });
    };
  }, [clips]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!video || !context || !activeClip || !current) return;
    const target = Math.min(activeClip.duration - 0.02, current.segment.start + current.offset);
    const paint = () => {
      if (video.readyState >= 2)
        drawFrame(
          context,
          video,
          fx,
          frameFxAt(effectForSegment(current.index, hook), current.offset / rate),
          true,
        );
    };
    video.addEventListener("loadeddata", paint);
    video.addEventListener("seeked", paint);
    video.playbackRate = rate;
    if (!playing || Math.abs(video.currentTime - target) > 0.25)
      video.currentTime = Math.max(0, target);
    if (playing) void video.play().catch(() => {});
    paint();
    return () => {
      video.removeEventListener("loadeddata", paint);
      video.removeEventListener("seeked", paint);
    };
  }, [cursor, activeClip, current, playing, fx, hook, rate]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (!audio || audio.ended) {
        setPlaying(false);
        videoRef.current?.pause();
        return;
      }
      setCursor(audio.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(
    () => () => {
      void gainRef.current?.context.close();
    },
    [],
  );
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.gain.value = voiceGain;
  }, [voiceGain]);

  const togglePlayback = async () => {
    if (playing) {
      stop();
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (!gainRef.current) {
      const context = new AudioContext();
      const gain = context.createGain();
      context.createMediaElementSource(audio).connect(gain);
      gain.connect(context.destination);
      gainRef.current = { context, gain };
    }
    gainRef.current.gain.gain.value = voiceGain;
    await gainRef.current.context.resume();
    if (cursor >= duration - 0.05) seek(0);
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const pointerDown = (event: PointerEvent, index: number, kind: "move" | "resize") => {
    event.stopPropagation();
    stop();
    setSelected(index);
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { kind, index, x: event.clientX, original: segments };
  };
  const pointerMove = (event: PointerEvent) => {
    const drag = gesture.current;
    if (!drag || drag.kind !== "resize") return;
    onChange(
      resizeBoundary(drag.original, clips, drag.index, ((event.clientX - drag.x) / zoom) * rate),
    );
  };
  const pointerUp = (event: PointerEvent) => {
    const drag = gesture.current;
    gesture.current = null;
    if (!drag) return;
    if (drag.kind === "resize") {
      setPast((items) => [...items.slice(-39), drag.original]);
      setFuture([]);
      return;
    }
    if (Math.abs(event.clientX - drag.x) < 5) {
      const start =
        segments.slice(0, drag.index).reduce((sum, segment) => sum + segment.duration, 0) / rate;
      seek(start + (segments[drag.index]?.duration ?? 0) / rate / 2);
      return;
    }
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const target = sequenceAt(segments, Math.max(0, (event.clientX - rect.left) / zoom) * rate);
    if (target) {
      commit(moveSequence(segments, drag.index, target.index));
      setSelected(target.index);
    }
  };

  return (
    <section className="min-w-0 space-y-5" aria-label="Alignement voix et visuel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Aligner la voix et le visuel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {segments.length} séquences · {clock(duration)} · {rate}×
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            title="Annuler"
            aria-label="Annuler"
            disabled={!past.length}
            onClick={() => {
              const previous = past.at(-1);
              if (!previous) return;
              stop();
              setFuture((items) => [segments, ...items]);
              setPast((items) => items.slice(0, -1));
              onChange(previous);
            }}
          >
            <Undo2 />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="Rétablir"
            aria-label="Rétablir"
            disabled={!future.length}
            onClick={() => {
              const next = future[0];
              if (!next) return;
              stop();
              setPast((items) => [...items, segments]);
              setFuture((items) => items.slice(1));
              onChange(next);
            }}
          >
            <Redo2 />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="Revenir au montage automatique"
            aria-label="Revenir au montage automatique"
            onClick={() => {
              stop();
              setPast((items) => [...items, segments]);
              setFuture([]);
              onReset();
            }}
          >
            <RotateCcw />
          </Button>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="mx-auto w-[180px] md:w-full">
          <canvas
            ref={canvasRef}
            width={540}
            height={960}
            className="aspect-[9/16] w-full rounded-lg bg-background"
          />
          <video
            ref={videoRef}
            src={activeClip?.url}
            crossOrigin="anonymous"
            muted
            playsInline
            preload="auto"
            className="hidden"
          />
          <audio ref={audioRef} src={voiceUrl} preload="auto" className="hidden" />
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              size="icon"
              variant="secondary"
              aria-label={playing ? "Mettre en pause" : "Lire le montage"}
              title={playing ? "Pause" : "Lecture"}
              onClick={() => void togglePlayback()}
            >
              {playing ? <Pause /> : <Play />}
            </Button>
            <span className="font-mono text-xs tabular-nums">{clock(cursor)}</span>
          </div>
        </div>
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={!canSplit || playing}
              onClick={() => commit(splitSequence(segments, selected, splitOffset))}
            >
              <Scissors /> Couper
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Déplacer à gauche"
              aria-label="Déplacer à gauche"
              disabled={selected === 0 || playing}
              onClick={() => {
                commit(moveSequence(segments, selected, selected - 1));
                setSelected(selected - 1);
              }}
            >
              <ArrowLeft />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Déplacer à droite"
              aria-label="Déplacer à droite"
              disabled={selected >= segments.length - 1 || playing}
              onClick={() => {
                commit(moveSequence(segments, selected, selected + 1));
                setSelected(selected + 1);
              }}
            >
              <ArrowRight />
            </Button>
            <div className="ml-auto flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                title="Dézoomer"
                aria-label="Dézoomer"
                disabled={zoom <= 12}
                onClick={() => setZoom((value) => Math.max(12, value / 1.5))}
              >
                <ZoomOut />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Zoomer"
                aria-label="Zoomer"
                disabled={zoom >= 180}
                onClick={() => setZoom((value) => Math.min(180, value * 1.5))}
              >
                <ZoomIn />
              </Button>
            </div>
          </div>
          <div
            className="overflow-x-auto rounded-lg border border-border bg-background"
            aria-label="Timeline"
          >
            <div className="relative min-w-full" style={{ width: Math.max(560, duration * zoom) }}>
              <div
                className="relative h-8 border-b border-border text-[10px] text-muted-foreground"
                onPointerDown={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  seek((event.clientX - rect.left) / zoom);
                }}
              >
                {Array.from({ length: Math.ceil(duration / 5) + 1 }, (_, i) => (
                  <span
                    key={i}
                    className="absolute top-2 border-l border-border pl-1"
                    style={{ left: i * 5 * zoom }}
                  >
                    {clock(i * 5)}
                  </span>
                ))}
              </div>
              <div ref={trackRef} className="flex h-24 py-2">
                {segments.map((segment, index) => {
                  const clip = clips[segment.clip];
                  return (
                    <div
                      key={index}
                      className="relative h-full shrink-0"
                      style={{ width: (segment.duration / rate) * zoom }}
                    >
                      <Button
                        variant="ghost"
                        className={`h-full w-full touch-none flex-col items-start justify-end overflow-hidden rounded-md border px-2 py-1 text-left ${index === selected ? "border-primary bg-primary/15" : "border-border bg-secondary/40"}`}
                        aria-label={`Séquence ${index + 1} : ${clip?.name ?? "Clip"}`}
                        onPointerDown={(event) => pointerDown(event, index, "move")}
                        onPointerUp={pointerUp}
                        onPointerCancel={() => {
                          gesture.current = null;
                        }}
                        onClick={() => setSelected(index)}
                      >
                        {clip && thumbnails[clip.id] && (
                          <img
                            src={thumbnails[clip.id]}
                            alt=""
                            draggable={false}
                            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
                          />
                        )}
                        <span className="relative w-full truncate text-xs font-semibold">
                          {index + 1}. {clip?.name}
                        </span>
                        <span className="relative text-[10px]">
                          {(segment.duration / rate).toFixed(2)} s
                        </span>
                      </Button>
                      {index < segments.length - 1 && (
                        <Button
                          variant="ghost"
                          className="absolute right-0 top-0 h-full w-2 touch-none cursor-col-resize rounded-none bg-primary/30 p-0 hover:bg-primary/70"
                          aria-label={`Ajuster la coupe ${index + 1}`}
                          title="Ajuster la coupe"
                          onPointerDown={(event) => pointerDown(event, index, "resize")}
                          onPointerMove={pointerMove}
                          onPointerUp={pointerUp}
                          onPointerCancel={() => {
                            const original = gesture.current?.original;
                            gesture.current = null;
                            if (original) onChange(original);
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div
                className="relative h-20 border-t border-border bg-primary/5"
                onPointerDown={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  seek((event.clientX - rect.left) / zoom);
                }}
              >
                <div className="absolute left-2 top-1 flex items-center gap-1 text-[10px] text-primary">
                  <Volume2 className="size-3" /> Voix off
                </div>
                {waveform.length > 0 ? (
                  <svg
                    className="absolute bottom-1 h-12"
                    style={{ width: duration * zoom }}
                    viewBox="0 0 700 50"
                    preserveAspectRatio="none"
                    aria-label="Forme d’onde de la voix"
                  >
                    <path
                      d={waveform
                        .map((peak, index) => `M${index} ${25 - peak * 23}V${25 + peak * 23}`)
                        .join(" ")}
                      className="stroke-primary"
                      strokeWidth="0.7"
                    />
                  </svg>
                ) : (
                  <span className="absolute bottom-5 left-3 text-xs text-muted-foreground">
                    Voix off · {clock(duration)}
                  </span>
                )}
              </div>
              <div
                className="pointer-events-none absolute inset-y-0 z-10 w-px bg-destructive"
                style={{ left: cursor * zoom }}
              >
                <span className="absolute -left-1 top-0 h-2 w-2 bg-destructive" />
              </div>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.01}
            value={cursor}
            aria-label="Position de lecture"
            className="w-full accent-primary"
            onChange={(event) => seek(Number(event.target.value))}
          />
          {selectedSegment && selectedClip && (
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Séquence {selected + 1}</p>
                <p className="max-w-72 truncate text-sm font-medium">{selectedClip.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {clock(selectedStart)} — {clock(selectedStart + selectedSegment.duration / rate)}
                </p>
              </div>
              <div className="w-32">
                <Label htmlFor="source-start" className="text-xs">
                  Début dans le clip (s)
                </Label>
                <Input
                  id="source-start"
                  type="number"
                  min={0}
                  max={Math.max(0, selectedClip.duration - selectedSegment.duration)}
                  step={0.05}
                  value={Number(selectedSegment.start.toFixed(2))}
                  onChange={(event) => {
                    const start = Math.min(
                      Math.max(0, selectedClip.duration - selectedSegment.duration),
                      Math.max(0, Number(event.target.value)),
                    );
                    commit(
                      segments.map((segment, index) =>
                        index === selected ? { ...segment, start } : segment,
                      ),
                    );
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
