import { createFileRoute } from "@tanstack/react-router";

/**
 * Notifications PayPal : renouvellements, résiliations, expirations.
 * Rien n'est appliqué sur la foi du corps reçu : chaque abonnement est relu
 * via l'API PayPal avant toute modification de crédits.
 */
export const Route = createFileRoute("/api/public/paypal/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { paypal } = await import("@/lib/paypal.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const raw = await request.text();

        let event: { id?: string; event_type?: string; resource?: Record<string, unknown> };
        try {
          event = JSON.parse(raw) as typeof event;
        } catch {
          return new Response("bad json", { status: 400 });
        }
        const type = event.event_type ?? "";
        const resource = (event.resource ?? {}) as Record<string, unknown>;

        // Signature vérifiée quand l'identifiant de webhook est configuré.
        const webhookId = process.env["PAYPAL_WEBHOOK_ID"];
        if (webhookId) {
          const verified = await paypal<{ verification_status?: string }>(
            "/v1/notifications/verify-webhook-signature",
            {
              method: "POST",
              body: {
                auth_algo: request.headers.get("paypal-auth-algo"),
                cert_url: request.headers.get("paypal-cert-url"),
                transmission_id: request.headers.get("paypal-transmission-id"),
                transmission_sig: request.headers.get("paypal-transmission-sig"),
                transmission_time: request.headers.get("paypal-transmission-time"),
                webhook_id: webhookId,
                webhook_event: JSON.parse(raw),
              },
            },
          ).catch(() => null);
          if (verified?.verification_status !== "SUCCESS") {
            return new Response("invalid signature", { status: 401 });
          }
        }

        // Idempotence.
        if (event.id) {
          const { error } = await supabaseAdmin
            .from("paypal_events")
            .insert({ id: event.id, type });
          if (error) return new Response("ok");
        }

        const subId =
          (resource["billing_agreement_id"] as string | undefined) ??
          (typeof resource["id"] === "string" && type.startsWith("BILLING.SUBSCRIPTION")
            ? (resource["id"] as string)
            : undefined);
        if (!subId) return new Response("ok");

        const { data: owner } = await supabaseAdmin
          .from("paypal_subscription_owners")
          .select("user_id, plan_id, amount_cents")
          .eq("paypal_subscription_id", subId)
          .maybeSingle();
        if (!owner) return new Response("ok");

        if (type === "BILLING.SUBSCRIPTION.EXPIRED" || type === "BILLING.SUBSCRIPTION.SUSPENDED") {
          await supabaseAdmin.rpc("stripe_end_subscription", {
            _stripe_subscription_id: subId,
          });
          return new Response("ok");
        }

        if (type === "BILLING.SUBSCRIPTION.CANCELLED") {
          await supabaseAdmin.rpc("stripe_mark_cancel_at_period_end", {
            _stripe_subscription_id: subId,
            _cancel: true,
          });
          return new Response("ok");
        }

        // Renouvellement ou activation : on relit l'abonnement chez PayPal.
        const sub = await paypal<{
          id: string;
          status?: string;
          plan_id?: string;
          start_time?: string;
          billing_info?: { next_billing_time?: string };
        }>(`/v1/billing/subscriptions/${subId}`).catch(() => null);
        if (!sub || (sub.status !== "ACTIVE" && sub.status !== "APPROVED")) {
          return new Response("ok");
        }

        const start = new Date();
        const next = sub.billing_info?.next_billing_time
          ? new Date(sub.billing_info.next_billing_time)
          : new Date(start.getTime() + 31 * 24 * 3600 * 1000);

        await supabaseAdmin.rpc("stripe_apply_subscription", {
          _user_id: owner.user_id,
          _plan_id: owner.plan_id,
          _mode: "live",
          _stripe_customer_id: `paypal:${owner.user_id}`,
          _stripe_subscription_id: subId,
          _stripe_price_id: sub.plan_id ?? owner.plan_id,
          _period_start: start.toISOString(),
          _renews_at: next.toISOString(),
          _cancel_at_period_end: false,
          _amount_cents: owner.amount_cents,
        });

        return new Response("ok");
      },
    },
  },
});
