export type Voiceover = { url: string; duration: number; name: string };

let current: Voiceover | null = null;
const listeners = new Set<(v: Voiceover | null) => void>();

export function setVoiceover(v: Voiceover | null) {
  current = v;
  listeners.forEach((l) => l(current));
}

export function getVoiceover() {
  return current;
}

export function subscribeVoiceover(l: (v: Voiceover | null) => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
