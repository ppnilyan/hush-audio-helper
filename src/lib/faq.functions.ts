import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FaqQuestion = {
  id: string;
  initials: string;
  question: string;
  answer: string | null;
  status: string;
  createdAt: string;
  expiresAt: string | null;
};

const initialsFrom = (claims: Record<string, unknown>): string => {
  const meta = (claims["user_metadata"] ?? {}) as Record<string, unknown>;
  const name = String(meta["full_name"] ?? meta["name"] ?? "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "";
    const b = (parts[1] ?? parts[0]?.slice(1) ?? "")[0] ?? "";
    return (a + b).toUpperCase() || "??";
  }
  const email = String(claims["email"] ?? "").trim();
  const local = email.split("@")[0] ?? "";
  const letters = local.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 2) return letters.slice(0, 2).toUpperCase();
  if (letters.length === 1) return letters.toUpperCase();
  return "??";
};

const map = (r: {
  id: string;
  initials: string;
  question: string;
  answer: string | null;
  status: string;
  created_at: string;
  expires_at: string | null;
}): FaqQuestion => ({
  id: r.id,
  initials: r.initials,
  question: r.question,
  answer: r.answer,
  status: r.status,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
});

const COLS = "id, initials, question, answer, status, created_at, expires_at";

/** Envoie une question (tout compte connecté). Elle reste en attente de modération. */
export const submitFaqQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { question: string }) => input)
  .handler(async ({ data, context }) => {
    const question = data.question.trim().slice(0, 400);
    if (question.length < 5) return { ok: false as const, code: "too_short" as const };
    const { error } = await context.supabase.from("faq_questions").insert({
      user_id: context.userId,
      question,
      initials: initialsFrom(context.claims as unknown as Record<string, unknown>),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Questions publiées et encore visibles (lecture publique via RLS). */
export const listPublishedFaqQuestions = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { apikey: key } },
  });
  const { data, error } = await client
    .from("faq_questions")
    .select(COLS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []).map(map);
});

/** Mes propres questions (pour suivre leur statut). */
export const listMyFaqQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("faq_questions")
      .select(COLS)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []).map(map);
  });

/** Toutes les questions — admin uniquement (RLS). */
export const listAllFaqQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("faq_questions")
      .select(COLS)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map(map);
  });

/** Approuve une question avec une réponse et une durée d'affichage (jours) — admin. */
export const answerFaqQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; answer: string; days: number }) => input)
  .handler(async ({ data, context }) => {
    const answer = data.answer.trim().slice(0, 1200);
    const days = Math.min(365, Math.max(1, Math.round(data.days)));
    if (answer.length < 2) return { ok: false as const, code: "too_short" as const };
    const now = new Date();
    const expires = new Date(now.getTime() + days * 86_400_000);
    const { error } = await context.supabase
      .from("faq_questions")
      .update({
        answer,
        status: "published",
        published_at: now.toISOString(),
        expires_at: expires.toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Supprime une question — admin. */
export const deleteFaqQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("faq_questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
