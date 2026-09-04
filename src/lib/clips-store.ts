/** Clips et liens conservés en mémoire pour survivre à l'aller-retour vers /auth. */
import type { ClipInfo } from "@/lib/montage";

export type ClipsSnapshot = {
  clips: ClipInfo[];
  rows: { id: string; url: string }[];
};

let current: ClipsSnapshot | null = null;

export function setClipsSnapshot(snapshot: ClipsSnapshot) {
  current = snapshot;
}

export function getClipsSnapshot(): ClipsSnapshot | null {
  return current;
}
