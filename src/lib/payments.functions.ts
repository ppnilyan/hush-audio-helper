import { createServerFn } from "@tanstack/react-start";
import type Stripe from "stripe";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

export type CheckoutSessionResult = { clientSecret: string } | { error: string };
export type PortalSessionResult = { url: string } | { error: string };

/** Correspondance entre les identifiants de prix et le catalogue interne. */
export const PRICE_TO_PLAN: Record<string, string> = {
  starter_monthly: "starter",
  pro_monthly: "pro",
  elite_monthly: "elite",
};

export const PRICE_TO_PACK: Record<string, string> = {
  pack50: "pack50",
  pack100: "pack100",
  pack300: "pack300",
  // Variantes « abonné » (−20 %) : même pack crédité.
  pack50_sub: "pack50",
  pack100_sub: "pack100",
  pack300_sub: "pack300",
};

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


/** Identifiant déterministe du coupon Stripe correspondant à un code promo. */
function couponId(code: string, percentOff: number): string {
  return `promo_${code.toUpperCase().replace(/[^A-Z0-9_]/g, "")}_${percentOff}`;
}

/** Récupère (ou crée) le coupon Stripe correspondant au code promo. */
async function ensureCoupon(stripe: Stripe, code: string, percentOff: number): Promise<string> {
  const id = couponId(code, percentOff);
  try {
    const existing = await stripe.coupons.retrieve(id);
    if (!existing.deleted) return id;
  } catch {
    /* coupon absent : on le crée */
  }
  const created = await stripe.coupons.create({
    id,
    percent_off: percentOff,
    duration: "forever",
    name: `${code.toUpperCase()} −${percentOff}%`,
  });
  return created.id;
}

async function resolveOrCreateCustomer(
  stripe: Stripe,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0]!.id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0]!;
      if (options.userId && customer.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

/** Crée une session de paiement intégrée (abonnement ou pack de crédits). */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      priceId: string;
      returnUrl: string;
      environment: StripeEnv;
      promoCode?: string;
      /** Montant affiché au client (centimes) : sert de contrôle avant paiement. */
      expectedAmountCents?: number;
    }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
      if (!PRICE_TO_PLAN[data.priceId] && !PRICE_TO_PACK[data.priceId]) {
        throw new Error("Unknown priceId");
      }
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);

      // Les abonnés (même après résiliation, jusqu'à la fin de période) paient −20 % sur les packs.
      let priceId = data.priceId;
      if (PRICE_TO_PACK[priceId] && !priceId.endsWith("_sub")) {
        if (await hasActiveSubscription(context.supabase, context.userId)) {
          priceId = `${priceId}_sub`;
        }
      }

      const prices = await stripe.prices.list({ lookup_keys: [priceId] });
      if (!prices.data.length) return { error: "Prix introuvable" };
      const stripePrice = prices.data[0]!;

      const isRecurring = stripePrice.type === "recurring";

      const email = context.claims?.email as string | undefined;
      const customerId = await resolveOrCreateCustomer(stripe, {
        ...(email ? { email } : {}),
        userId: context.userId,
      });

      let productDescription: string | undefined;
      if (!isRecurring) {
        const productId =
          typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product.id;
        const product = await stripe.products.retrieve(productId);
        productDescription = product.name;
      }

      // Code promo : la réduction affichée doit être celle réellement débitée.
      let couponRef: string | undefined;
      let promoPercent = 0;
      if (data.promoCode?.trim()) {
        const { data: lookup } = await context.supabase.rpc("promo_lookup", {
          _code: data.promoCode.trim(),
        });
        const res = lookup as unknown as { ok?: boolean; code?: string; percentOff?: number } | null;
        if (!res?.ok || !res.code) return { error: "Code de promotion invalide ou désactivé" };
        promoPercent = res.percentOff ?? 0;
        if (promoPercent > 0) couponRef = await ensureCoupon(stripe, res.code, promoPercent);
      }

      const metadata: Record<string, string> = {
        userId: context.userId,
        priceId,
        managed_payments: "true",
        ...(data.promoCode ? { promoCode: data.promoCode.trim().toUpperCase() } : {}),
        ...(promoPercent ? { promoPercentOff: String(promoPercent) } : {}),
      };

      const params = {
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        metadata,
        managed_payments: { enabled: true },
        ...(couponRef && { discounts: [{ coupon: couponRef }] }),
        ...(!isRecurring && { payment_intent_data: { description: productDescription } }),
        ...(isRecurring && { subscription_data: { metadata } }),
      } as Stripe.Checkout.SessionCreateParams;

      let session: Stripe.Checkout.Session;
      try {
        session = await stripe.checkout.sessions.create(params);
      } catch (err) {
        // Certaines options de conformité refusent les remises : on retombe sur le calcul de taxe.
        const message = getStripeErrorMessage(err);
        if (!couponRef || !/discount/i.test(message)) throw err;
        const { managed_payments: _omit, ...rest } = params as Record<string, unknown>;
        session = await stripe.checkout.sessions.create({
          ...rest,
          metadata: { ...metadata, managed_payments: "false" },
          automatic_tax: { enabled: true },
        } as Stripe.Checkout.SessionCreateParams);
      }

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Ouvre le portail de gestion (résiliation, moyen de paiement, factures). */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    const { data: sub, error } = await context.supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !sub?.stripe_customer_id) return { error: "Aucun abonnement trouvé" };

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (err) {
      return { error: getStripeErrorMessage(err) };
    }
  });

/**
 * Aligne un code promo sur Stripe : coupon créé quand le code est actif,
 * supprimé dès qu'il est désactivé ou effacé côté administration.
 */
export const syncPromoCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      code: string;
      percentOff: number;
      active: boolean;
      environment: StripeEnv;
    }) => data,
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false, error: "forbidden" };

    const code = data.code.trim().toUpperCase();
    const percent = Math.round(data.percentOff);
    if (!code || percent <= 0) return { ok: true };

    try {
      const stripe = createStripeClient(data.environment);
      if (data.active) {
        await ensureCoupon(stripe, code, percent);
      } else {
        await stripe.coupons.del(couponId(code, percent)).catch(() => null);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: getStripeErrorMessage(err) };
    }
  });
