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
  .inputValidator((input: { planId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("fake_subscribe", { _plan_id: data.planId });
    if (error) return { ok: false as const, code: fakeError(error.message) };
    return { ok: true as const };
  });

export const fakeBuyPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { packId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("fake_buy_pack", { _pack_id: data.packId });
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
