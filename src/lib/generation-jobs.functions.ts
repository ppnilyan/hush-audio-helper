import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GenerationJob = {
  id: string;
  status: "pending" | "done" | "refunded";
  createdAt: string;
  credits: number;
};

/** Délai avant qu'un job resté « en attente » soit considéré comme abandonné. */
const STALE_MS = 3 * 60 * 1000;

async function countHistory(
  supabase: { from: (t: "montage_history") => any },
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from("montage_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

/** Débite 10 crédits et ouvre un job de génération. */
export const startGenerationJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const before = await countHistory(supabase as never, userId);

    const { data: debit, error: debitError } = await supabase.rpc("consume_credits", {
      _amount: 10,
    });
    if (debitError) {
      if (debitError.message.includes("insufficient_credits")) {
        return { ok: false as const, code: "insufficient" as const };
      }
      throw new Error(debitError.message);
    }
    const d = debit as unknown as { fromMonthly: number; fromPurchased: number };

    const { data: job, error } = await supabase
      .from("generation_jobs")
      .insert({
        user_id: userId,
        status: "pending",
        credits: 10,
        from_monthly: d.fromMonthly,
        from_purchased: d.fromPurchased,
        history_count_before: before,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return {
      ok: true as const,
      jobId: job.id,
      fromMonthly: d.fromMonthly,
      fromPurchased: d.fromPurchased,
    };
  });

async function settleJob(
  supabase: any,
  userId: string,
  job: {
    id: string;
    from_monthly: number;
    from_purchased: number;
    history_count_before: number;
  },
): Promise<"done" | "refunded"> {
  const after = await countHistory(supabase, userId);
  if (after > job.history_count_before) {
    await supabase
      .from("generation_jobs")
      .update({ status: "done", settled_at: new Date().toISOString() })
      .eq("id", job.id);
    return "done";
  }
  await supabase.rpc("refund_credits", {
    _from_monthly: Math.max(0, job.from_monthly),
    _from_purchased: Math.max(0, job.from_purchased),
  });
  await supabase
    .from("generation_jobs")
    .update({ status: "refunded", settled_at: new Date().toISOString() })
    .eq("id", job.id);
  return "refunded";
}

/**
 * Clôture un job : terminé seulement si l'historique compte une vidéo de plus,
 * sinon les crédits sont remboursés.
 */
export const finishGenerationJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jobId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job, error } = await supabase
      .from("generation_jobs")
      .select("id, status, from_monthly, from_purchased, history_count_before")
      .eq("id", data.jobId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!job || job.status !== "pending") return { status: (job?.status ?? "done") as string };
    return { status: await settleJob(supabase, userId, job) };
  });

/** Rattrape les jobs abandonnés (onglet fermé) : remboursement automatique. */
export const reconcileGenerationJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const cutoff = new Date(Date.now() - STALE_MS).toISOString();
    const { data: jobs, error } = await supabase
      .from("generation_jobs")
      .select("id, from_monthly, from_purchased, history_count_before")
      .eq("user_id", userId)
      .eq("status", "pending")
      .lt("created_at", cutoff);
    if (error) throw new Error(error.message);
    let refunded = 0;
    for (const job of jobs ?? []) {
      if ((await settleJob(supabase, userId, job)) === "refunded") refunded += 1;
    }
    return { refunded };
  });

/** Générations échouées récentes, affichées dans l'historique. */
export const listFailedGenerations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("generation_jobs")
      .select("id, status, credits, created_at")
      .eq("user_id", userId)
      .eq("status", "refunded")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []).map(
      (r): GenerationJob => ({
        id: r.id,
        status: "refunded",
        credits: r.credits,
        createdAt: r.created_at,
      }),
    );
  });
