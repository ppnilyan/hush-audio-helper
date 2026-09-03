export type Silence = { start: number; end: number };

export type TrimResult = {
  buffer: AudioBuffer;
  removedCount: number;
  removedSeconds: number;
  reachedTarget: boolean;
  silencesFound: number;
};

/** Detect silent regions using an RMS threshold over short windows. */
export function detectSilences(
  buffer: AudioBuffer,
  thresholdDb = -45,
  windowMs = 10,
): Silence[] {
  const sr = buffer.sampleRate;
  const win = Math.max(1, Math.floor((windowMs / 1000) * sr));
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
  const threshold = Math.pow(10, thresholdDb / 20);

  const silences: Silence[] = [];
  let runStart: number | null = null;

  for (let i = 0; i < buffer.length; i += win) {
    const end = Math.min(i + win, buffer.length);
    let sum = 0;
    let n = 0;
    for (const data of channels) {
      for (let j = i; j < end; j++) {
        const v = data[j]!;
        sum += v * v;
        n++;
      }
    }
    const rms = Math.sqrt(sum / Math.max(1, n));
    const silent = rms < threshold;
    if (silent && runStart === null) runStart = i;
    if (!silent && runStart !== null) {
      silences.push({ start: runStart / sr, end: i / sr });
      runStart = null;
    }
  }
  if (runStart !== null) silences.push({ start: runStart / sr, end: buffer.length / sr });
  return silences;
}

/**
 * Remove silences one by one, in chronological order, checking the resulting
 * duration after each cut, until the target duration is reached.
 */
export function trimToTarget(
  buffer: AudioBuffer,
  opts: {
    minSilence: number;
    maxSilence: number;
    targetDuration: number;
    thresholdDb: number;
  },
): TrimResult {
  const { minSilence, maxSilence, targetDuration, thresholdDb } = opts;
  const sr = buffer.sampleRate;
  const all = detectSilences(buffer, thresholdDb);
  const candidates = all.filter((s) => s.end - s.start >= minSilence);

  let duration = buffer.duration;
  let removedSeconds = 0;
  let removedCount = 0;
  const cuts: Silence[] = [];

  for (const s of candidates) {
    if (duration <= targetDuration) break;
    const len = s.end - s.start;
    // never remove more than the max chosen by the user for one blank
    let removable = Math.min(len, maxSilence);
    // don't overshoot the target: keep the tail of the blank
    removable = Math.min(removable, duration - targetDuration);
    if (removable <= 0.001) continue;
    cuts.push({ start: s.start, end: s.start + removable });
    duration -= removable;
    removedSeconds += removable;
    removedCount++;
  }

  const newLength = Math.max(1, Math.round(duration * sr));
  const out = new AudioBuffer({
    length: newLength,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: sr,
  });

  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    let write = 0;
    let read = 0;
    for (const cut of cuts) {
      const cutStart = Math.floor(cut.start * sr);
      const cutEnd = Math.floor(cut.end * sr);
      for (let i = read; i < cutStart && write < newLength; i++) dst[write++] = src[i]!;
      read = Math.max(read, cutEnd);
    }
    for (let i = read; i < src.length && write < newLength; i++) dst[write++] = src[i]!;
  }

  return {
    buffer: out,
    removedCount,
    removedSeconds,
    reachedTarget: duration <= targetDuration + 0.05,
    silencesFound: candidates.length,
  };
}

export function encodeWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const len = buffer.length;
  const bytes = len * numCh * 2;
  const ab = new ArrayBuffer(44 + bytes);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * numCh * 2, true);
  view.setUint16(32, numCh * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, bytes, true);

  let off = 44;
  const chans: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c));
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, chans[c]![i]!));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

export function formatTime(sec: number): string {
  if (!isFinite(sec)) return "--:--";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}
