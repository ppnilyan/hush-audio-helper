import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PACKS, PLANS, packPrice, type PlanId } from "@/lib/billing";

export type PaypalConfig = { clientId: string; environment: "live" | "sandbox"; currency: "EUR" };

/** Identifiant public PayPal (nécessaire pour afficher les boutons). */
export const getPaypalConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<PaypalConfig> => {
    const env = (process.env["PAYPAL_ENV"] ?? "live").toLowerCase();
    return {
      clientId: process.env["PAYPAL_CLIENT_ID"] ?? "",
      environment: env === "sandbox" || env === "test" ? "sandbox" : "live",
      currency: "EUR",
    };
  },
);

/** Vrai si l'abonnement couvre encore la période payée (même résilié). */
async function hasActiveSubscription(
  supabase: { from: (t: "user_subscriptions") => any },
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("user_subscriptions")
    .select("status, renews_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return false;
  const active = data.status === "active" || data.status === "canceled";
  return active && new Date(data.renews_at).getTime() > Date.now();
}

/** Pourcentage de remise d'un code promo, vérifié côté serveur. */
async function promoPercent(
  supabase: { rpc: (fn: "promo_lookup", args: { _code: string }) => Promise<{ data: unknown }> },
  code: string | null | undefined,
): Promise<{ percent: number; code: string | null; error?: string }> {
  const raw = code?.trim();
  if (!raw) return { percent: 0, code: null };
  const { data } = await supabase.rpc("promo_lookup", { _code: raw });
  const res = data as { ok?: boolean; code?: string; percentOff?: number } | null;
  if (!res?.ok || !res.code) {
    return { percent: 0, code: null, error: "Code de promotion invalide ou désactivé" };
  }
  return { percent: res.percentOff ?? 0, code: res.code };
}

const applyPercent = (cents: number, percent: number) =>
  percent > 0 ? Math.round((cents * (100 - percent)) / 100) : cents;

/** Prix serveur d'un pack (remise abonné + code promo). */
async function packAmount(
  supabase: any,
  userId: string,
  packId: string,
  promoCode: string | null | undefined,
) {
  const pack = PACKS.find((p) => p.id === packId);
  if (!pack) throw new Error("Pack inconnu");
  const subscriber = await hasActiveSubscription(supabase, userId);
  const promo = await promoPercent(supabase, promoCode);
  if (promo.error) throw new Error(promo.error);
  return {
    pack,
    amountCents: applyPercent(packPrice(pack, subscriber), promo.percent),
    promo,
  };
}

/** Prix serveur d'une formule (code promo appliqué au tarif mensuel). */
async function planAmount(supabase: any, planId: string, promoCode: string | null | undefined) {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) throw new Error("Formule inconnue");
  const promo = await promoPercent(supabase, promoCode);
  if (promo.error) throw new Error(promo.error);
  return { plan, amountCents: applyPercent(plan.priceCents, promo.percent), promo };
}

/* ---------------------------------------------------------------- packs */

/** Crée une commande PayPal pour un pack de crédits. Montant calculé côté serveur. */
export const createPaypalOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { packId: string; promoCode?: string | null }) => data)
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; orderId: string; amountCents: number } | { ok: false; error: string }> => {
      const { paypal, toAmount } = await import("@/lib/paypal.server");
      try {
        const { pack, amountCents } = await packAmount(
          context.supabase,
          context.userId,
          data.packId,
          data.promoCode,
        );
        const order = await paypal<{ id: string }>("/v2/checkout/orders", {
          method: "POST",
          body: {
            intent: "CAPTURE",
            purchase_units: [
              {
                custom_id: `${context.userId}|${pack.id}`,
                description: `SilenceCut — ${pack.credits} crédits`,
                amount: { currency_code: "EUR", value: toAmount(amountCents) },
              },
            ],
            application_context: {
              brand_name: "SilenceCut",
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
            },
          },
        });
        return { ok: true, orderId: order.id, amountCents };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
  );

/** Capture la commande PayPal puis crédite le pack après vérification serveur. */
export const capturePaypalOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; packId: string; promoCode?: string | null }) => data)
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; credits: number } | { ok: false; error: string }> => {
      const { paypal } = await import("@/lib/paypal.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      try {
        const { pack, amountCents } = await packAmount(
          context.supabase,
          context.userId,
          data.packId,
          data.promoCode,
        );

        type Capture = {
          status?: string;
          purchase_units?: {
            custom_id?: string;
            payments?: {
              captures?: { id: string; status?: string; amount?: { value?: string } }[];
            };
          }[];
        };
        let order = await paypal<Capture>(`/v2/checkout/orders/${data.orderId}/capture`, {
          method: "POST",
          headers: { "PayPal-Request-Id": `cap_${data.orderId}` },
        }).catch(async (e: Error) => {
          // Déjà capturée (double clic / reprise) : on relit la commande.
          if (/ORDER_ALREADY_CAPTURED|already been captured/i.test(e.message)) {
            return paypal<Capture>(`/v2/checkout/orders/${data.orderId}`);
          }
          throw e;
        });

        const unit = order.purchase_units?.[0];
        const capture = unit?.payments?.captures?.[0];
        if (order.status !== "COMPLETED" || capture?.status !== "COMPLETED") {
          return { ok: false, error: "Paiement non confirmé par PayPal." };
        }
        if (unit?.custom_id && !unit.custom_id.startsWith(`${context.userId}|`)) {
          return { ok: false, error: "Paiement associé à un autre compte." };
        }
        const paid = Math.round(Number(capture.amount?.value ?? "0") * 100);
        if (Math.abs(paid - amountCents) > 1) {
          return { ok: false, error: "Montant payé différent du montant attendu." };
        }

        // Idempotence : un même paiement ne crédite qu'une fois.
        const { error: dup } = await supabaseAdmin
          .from("paypal_events")
          .insert({ id: `capture_${capture.id}`, type: "ORDER.CAPTURED" });
        if (dup) return { ok: true, credits: pack.credits };

        const { error } = await supabaseAdmin.rpc("stripe_apply_pack", {
          _user_id: context.userId,
          _pack_id: pack.id,
          _mode: "live",
          _amount_cents: paid,
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true, credits: pack.credits };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
  );

/* -------------------------------------------------------- abonnements */

/** Plan PayPal (créé une seule fois) correspondant à une formule + remise éventuelle. */
export const getPaypalPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planId: string; promoCode?: string | null }) => data)
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; planId: string; amountCents: number } | { ok: false; error: string }> => {
      const { paypal, toAmount } = await import("@/lib/paypal.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      try {
        const { plan, amountCents } = await planAmount(
          context.supabase,
          data.planId,
          data.promoCode,
        );
        const key = `plan_${plan.id}_${amountCents}`;

        const { data: cached } = await supabaseAdmin
          .from("paypal_catalog")
          .select("paypal_id")
          .eq("key", key)
          .maybeSingle();
        if (cached?.paypal_id) {
          return { ok: true, planId: cached.paypal_id, amountCents };
        }

        // Produit unique partagé par toutes les formules.
        const productKey = "product_subscriptions";
        const { data: cachedProduct } = await supabaseAdmin
          .from("paypal_catalog")
          .select("paypal_id")
          .eq("key", productKey)
          .maybeSingle();
        let productId = cachedProduct?.paypal_id ?? null;
        if (!productId) {
          const product = await paypal<{ id: string }>("/v1/catalogs/products", {
            method: "POST",
            body: {
              name: "SilenceCut — abonnement",
              description: "Crédits mensuels pour générer des montages verticaux",
              type: "SERVICE",
              category: "SOFTWARE",
            },
          });
          productId = product.id;
          await supabaseAdmin
            .from("paypal_catalog")
            .insert({ key: productKey, paypal_id: productId, amount_cents: 0 });
        }

        const created = await paypal<{ id: string }>("/v1/billing/plans", {
          method: "POST",
          body: {
            product_id: productId,
            name: `SilenceCut ${plan.name} — ${toAmount(amountCents)} EUR`,
            description: `${plan.monthlyCredits} crédits par mois`,
            billing_cycles: [
              {
                frequency: { interval_unit: "MONTH", interval_count: 1 },
                tenure_type: "REGULAR",
                sequence: 1,
                total_cycles: 0,
                pricing_scheme: {
                  fixed_price: { value: toAmount(amountCents), currency_code: "EUR" },
                },
              },
            ],
            payment_preferences: {
              auto_bill_outstanding: true,
              setup_fee_failure_action: "CANCEL",
              payment_failure_threshold: 2,
            },
            // Prix TTC : la TVA est comprise dans le montant affiché.
            taxes: { percentage: "0", inclusive: true },
          },
        });
        await supabaseAdmin
          .from("paypal_catalog")
          .insert({ key, paypal_id: created.id, amount_cents: amountCents });
        return { ok: true, planId: created.id, amountCents };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
  );

/** Active l'abonnement après vérification de son statut réel chez PayPal. */
export const activatePaypalSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { subscriptionId: string; planId: string; promoCode?: string | null }) => data,
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { paypal } = await import("@/lib/paypal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const { plan, amountCents } = await planAmount(context.supabase, data.planId, data.promoCode);

      const sub = await paypal<{
        id: string;
        status?: string;
        plan_id?: string;
        custom_id?: string;
        start_time?: string;
        billing_info?: { next_billing_time?: string };
      }>(`/v1/billing/subscriptions/${data.subscriptionId}`);

      if (sub.status !== "ACTIVE" && sub.status !== "APPROVED") {
        return { ok: false, error: "Abonnement non confirmé par PayPal." };
      }
      if (sub.custom_id && sub.custom_id !== context.userId) {
        return { ok: false, error: "Abonnement associé à un autre compte." };
      }

      const start = sub.start_time ? new Date(sub.start_time) : new Date();
      const next = sub.billing_info?.next_billing_time
        ? new Date(sub.billing_info.next_billing_time)
        : new Date(start.getTime() + 31 * 24 * 3600 * 1000);

      await supabaseAdmin.from("paypal_subscription_owners").upsert({
        paypal_subscription_id: sub.id,
        user_id: context.userId,
        plan_id: plan.id,
        amount_cents: amountCents,
      });

      const { error } = await supabaseAdmin.rpc("stripe_apply_subscription", {
        _user_id: context.userId,
        _plan_id: plan.id,
        _mode: "live",
        _stripe_customer_id: `paypal:${context.userId}`,
        _stripe_subscription_id: sub.id,
        _stripe_price_id: sub.plan_id ?? plan.id,
        _period_start: start.toISOString(),
        _renews_at: next.toISOString(),
        _cancel_at_period_end: false,
        _amount_cents: amountCents,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

/** Résilie l'abonnement : l'accès et les crédits restent jusqu'à la fin de la période payée. */
export const cancelPaypalSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { paypal } = await import("@/lib/paypal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await context.supabase
      .from("user_subscriptions")
      .select("stripe_subscription_id, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!sub?.stripe_subscription_id) return { ok: false, error: "Aucun abonnement trouvé" };
    try {
      await paypal(`/v1/billing/subscriptions/${sub.stripe_subscription_id}/cancel`, {
        method: "POST",
        body: { reason: "Résiliation demandée par le client" },
      }).catch((e: Error) => {
        if (!/status|INVALID|not.*active/i.test(e.message)) throw e;
      });
      const { error } = await supabaseAdmin.rpc("stripe_mark_cancel_at_period_end", {
        _stripe_subscription_id: sub.stripe_subscription_id,
        _cancel: true,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
