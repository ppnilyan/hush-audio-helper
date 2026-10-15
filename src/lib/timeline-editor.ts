import { buildTimeline, type ClipInfo, type Segment } from "@/lib/montage";

export const MIN_SEQUENCE = 0.1;

/** All editing uses source seconds; playback seconds are divided by the speed. */
export function fitTimeline(segments: Segment[], clips: ClipInfo[], duration: number): Segment[] {
  const result: Segment[] = [];
  let remaining = duration;
  for (const segment of segments) {
    const clip = clips[segment.clip];
    if (!clip || remaining <= 0.001 || clip.duration <= 0) continue;
    const start = Math.max(0, Math.min(segment.start, Math.max(0, clip.duration - MIN_SEQUENCE)));
    const length = Math.min(
      Math.max(MIN_SEQUENCE, segment.duration),
      clip.duration - start,
      remaining,
    );
    if (length > 0.001) {
      result.push({ clip: segment.clip, start, duration: length });
      remaining -= length;
    }
  }
  if (remaining > 0.001) result.push(...buildTimeline(clips, remaining, 0));
  return result;
}

export function splitSequence(segments: Segment[], index: number, offset: number): Segment[] {
  const segment = segments[index];
  if (!segment || offset < MIN_SEQUENCE || segment.duration - offset < MIN_SEQUENCE)
    return segments;
  return [
    ...segments.slice(0, index),
    { ...segment, duration: offset },
    { ...segment, start: segment.start + offset, duration: segment.duration - offset },
    ...segments.slice(index + 1),
  ];
}

export function moveSequence(segments: Segment[], from: number, to: number): Segment[] {
  if (from === to || !segments[from] || !segments[to]) return segments;
  const next = [...segments];
  const [segment] = next.splice(from, 1);
  if (!segment) return segments;
  next.splice(to, 0, segment);
  return next;
}

export function resizeBoundary(
  segments: Segment[],
  clips: ClipInfo[],
  index: number,
  delta: number,
): Segment[] {
  const left = segments[index];
  const right = segments[index + 1];
  const clip = left && clips[left.clip];
  if (!left || !right || !clip) return segments;
  const change = Math.max(
    MIN_SEQUENCE - left.duration,
    -right.start,
    Math.min(delta, right.duration - MIN_SEQUENCE, clip.duration - left.start - left.duration),
  );
  return segments.map((segment, i) =>
    i === index
      ? { ...left, duration: left.duration + change }
      : i === index + 1
        ? { ...right, start: right.start + change, duration: right.duration - change }
        : segment,
  );
}

export function sequenceAt(segments: Segment[], sourceTime: number) {
  let start = 0;
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (!segment) continue;
    if (sourceTime < start + segment.duration || index === segments.length - 1)
      return {
        segment,
        index,
        start,
        offset: Math.max(0, Math.min(segment.duration, sourceTime - start)),
      };
    start += segment.duration;
  }
  return null;
}
