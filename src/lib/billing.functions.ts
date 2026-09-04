import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BillingPlanState = {
  id: string;
  name: string;
  priceCents: number;
  monthlyCredits: number;
  allowAdvanced: boolean;
  allowAllThemes: boolean;
  allowImportMusic: boolean;
  renewsAt: string;
  periodStart: string;
  mode: "test" | "live";
};

export type BillingState = {
  isAdmin: boolean;
  fakeBalanceCents: number | null;
  purchasedCredits: number;
  monthlyCredits: number;
  plan: BillingPlanState | null;
};

export type CreditTransaction = {
  id: string;
  kind: string;
  credits: number;
  amountCents: number;
  mode: string;
  note: string | null;
  createdAt: string;
};

/** État de facturation du compte connecté (formule, crédits, mode test). */
export const getBillingState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("billing_state");
    if (error) throw new Error(error.message);
    return data as unknown as BillingState;
  });

/** Débite 10 crédits pour une génération (mensuels d'abord, puis achetés). */
export const consumeCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("consume_credits", { _amount: 10 });
    if (error) {
      if (error.message.includes("insufficient_credits")) {
        return { ok: false as const, code: "insufficient" as const };
      }
      throw new Error(error.message);
    }
    const d = data as unknown as { fromMonthly: number; fromPurchased: number };
    return { ok: true as const, fromMonthly: d.fromMonthly, fromPurchased: d.fromPurchased };
  });

/** Rembourse les crédits d'une génération qui a échoué. */
export const refundCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fromMonthly: number; fromPurchased: number }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("refund_credits", {
      _from_monthly: Math.max(0, Math.floor(data.fromMonthly)),
      _from_purchased: Math.max(0, Math.floor(data.fromPurchased)),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Historique des mouvements de crédits du compte connecté. */
export const listTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("credit_transactions")
      .select("id, kind, credits, amount_cents, mode, note, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map(
      (r): CreditTransaction => ({
        id: r.id,
        kind: r.kind,
        credits: r.credits,
        amountCents: r.amount_cents,
        mode: r.mode,
        note: r.note,
        createdAt: r.created_at,
      }),
    );
  });

/* ---------------- Mode fictif (admin uniquement, vérifié en base) ---------------- */

const fakeError = (message: string) => {
  if (message.includes("forbidden")) return "forbidden" as const;
  if (message.includes("insufficient_balance")) return "insufficient_balance" as const;
  return "error" as const;
};

export const fakeSubscribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { planId: string; promoCode?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("fake_subscribe", {
      _plan_id: data.planId,
      _promo_code: data.promoCode ?? null,
    });
    if (error) return { ok: false as const, code: fakeError(error.message) };
    return { ok: true as const };
  });

export const fakeBuyPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { packId: string; promoCode?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("fake_buy_pack", {
      _pack_id: data.packId,
      _promo_code: data.promoCode ?? null,
    });
    if (error) return { ok: false as const, code: fakeError(error.message) };
    return { ok: true as const };
  });

export const fakeCancel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("fake_cancel");
    if (error) return { ok: false as const, code: fakeError(error.message) };
    return { ok: true as const };
  });

/* ---------------- Codes de promotion ---------------- */

export type PromoCode = { code: string; percentOff: number; active: boolean; uses: number };

/** Vérifie un code saisi par un client (tout compte connecté). */
export const lookupPromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("promo_lookup", { _code: data.code });
    if (error) throw new Error(error.message);
    return res as unknown as { ok: boolean; code?: string; percentOff?: number };
  });

/** Liste des codes (admin uniquement, RLS). */
export const listPromoCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("promo_codes")
      .select("code, percent_off, active, uses")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(
      (r): PromoCode => ({
        code: r.code,
        percentOff: r.percent_off,
        active: r.active,
        uses: r.uses,
      }),
    );
  });

/** Crée (ou met à jour) un code de promotion — admin uniquement. */
export const createPromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; percentOff: number }) => input)
  .handler(async ({ data, context }) => {
    const code = data.code.trim().toUpperCase();
    const percent = Math.round(data.percentOff);
    if (!code || code.length > 32) return { ok: false as const, code: "invalid_code" as const };
    if (percent < 0 || percent > 100) return { ok: false as const, code: "invalid_percent" as const };
    const { error } = await context.supabase.rpc("promo_create", {
      _code: code,
      _percent: percent,
    });
    if (error) return { ok: false as const, code: fakeError(error.message) };
    return { ok: true as const };
  });

/** Supprime un code — admin uniquement. */
export const deletePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("promo_delete", { _code: data.code });
    if (error) return { ok: false as const, code: fakeError(error.message) };
    return { ok: true as const };
  });

