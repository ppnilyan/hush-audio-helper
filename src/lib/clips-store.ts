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

/* ---------- Liens saisis sur la page d'accueil publique ---------- */

const PENDING_KEY = "sc.pendingLinks";

/** Mémorise les liens saisis avant l'inscription (survit à un rechargement). */
export function setPendingLinks(urls: string[]) {
  const clean = urls.map((u) => u.trim()).filter(Boolean);
  if (typeof localStorage === "undefined") return;
  if (clean.length === 0) localStorage.removeItem(PENDING_KEY);
  else localStorage.setItem(PENDING_KEY, JSON.stringify(clean));
}

/** Récupère puis efface les liens mémorisés. */
export function takePendingLinks(): string[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(PENDING_KEY);
  if (!raw) return [];
  localStorage.removeItem(PENDING_KEY);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}
