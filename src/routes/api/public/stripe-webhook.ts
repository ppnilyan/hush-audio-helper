import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { PRICE_TO_PACK, PRICE_TO_PLAN } from "@/lib/payments.functions";

const secretFor = (env: StripeEnv) =>
  env === "sandbox"
    ? process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"]
    : process.env["PAYMENTS_LIVE_WEBHOOK_SECRET"];

const modeFor = (env: StripeEnv) => (env === "sandbox" ? "test" : "live");

/** Identifiant interne du prix (lookup_key ou métadonnée Lovable). */
function priceKey(price: Stripe.Price | null | undefined): string | null {
  if (!price) return null;
  return price.lookup_key ?? (price.metadata?.["lovable_external_id"] as string | undefined) ?? null;
}

async function handleEvent(event: Stripe.Event, env: StripeEnv, stripe: Stripe) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const mode = modeFor(env);

  // Idempotence : un même événement n'est traité qu'une fois.
  const { error: seenError } = await supabaseAdmin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (seenError) return;

  const applySubscription = async (subscriptionId: string, amountCents: number) => {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price"] });
    const userId =
      (sub.metadata?.["userId"] as string | undefined) ??
      (typeof sub.customer === "string"
        ? ((await stripe.customers.retrieve(sub.customer)) as Stripe.Customer).metadata?.["userId"]
        : undefined);
    const item = sub.items.data[0];
    const key = priceKey(item?.price);
    const planId = key ? PRICE_TO_PLAN[key] : undefined;
    if (!userId || !planId || !item) return;

    const periodStart = new Date((item.current_period_start ?? 0) * 1000).toISOString();
    const renewsAt = new Date((item.current_period_end ?? 0) * 1000).toISOString();

    await supabaseAdmin.rpc("stripe_apply_subscription", {
      _user_id: userId,
      _plan_id: planId,
      _mode: mode,
      _stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      _stripe_subscription_id: sub.id,
      _stripe_price_id: key ?? "",
      _period_start: periodStart,
      _renews_at: renewsAt,
      _cancel_at_period_end: !!sub.cancel_at_period_end,
      _amount_cents: amountCents,
    });
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.payment_status !== "paid" && session.status !== "complete") break;

      if (session.mode === "subscription" && session.subscription) {
        const subId =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        await applySubscription(subId, session.amount_total ?? 0);
        break;
      }

      const userId = session.metadata?.["userId"];
      const key = session.metadata?.["priceId"];
      const packId = key ? PRICE_TO_PACK[key] : undefined;
      if (userId && packId) {
        await supabaseAdmin.rpc("stripe_apply_pack", {
          _user_id: userId,
          _pack_id: packId,
          _mode: mode,
          _amount_cents: session.amount_total ?? 0,
        });
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | { id: string } | null;
        parent?: { subscription_details?: { subscription?: string | { id: string } } };
      };
      const raw =
        invoice.subscription ?? invoice.parent?.subscription_details?.subscription ?? null;
      const subId = typeof raw === "string" ? raw : raw?.id;
      if (subId) await applySubscription(subId, invoice.amount_paid ?? 0);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object;
      await supabaseAdmin.rpc("stripe_mark_cancel_at_period_end", {
        _stripe_subscription_id: sub.id,
        _cancel: !!sub.cancel_at_period_end,
      });
      // Changement de formule : on aligne le quota sur la nouvelle formule.
      if (sub.status === "active" || sub.status === "trialing") {
        await applySubscription(sub.id, 0);
      }
      break;
    }

    case "customer.subscription.deleted": {
      await supabaseAdmin.rpc("stripe_end_subscription", {
        _stripe_subscription_id: event.data.object.id,
      });
      break;
    }

    default:
      break;
  }
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env: StripeEnv = url.searchParams.get("env") === "live" ? "live" : "sandbox";
        const secret = secretFor(env);
        const signature = request.headers.get("stripe-signature");
        if (!secret || !signature) return new Response("Missing signature", { status: 401 });

        const body = await request.text();
        const stripe = createStripeClient(env);
        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, signature, secret);
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          await handleEvent(event, env, stripe);
        } catch (error) {
          console.error("stripe webhook", error);
          return new Response("error", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});
