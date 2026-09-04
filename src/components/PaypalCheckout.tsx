import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  activatePaypalSubscription,
  capturePaypalOrder,
  createPaypalOrder,
  getPaypalConfig,
  getPaypalPlan,
} from "@/lib/paypal.functions";

type Props = {
  /** Pack de crédits (paiement unique) ou formule mensuelle (abonnement). */
  target: { kind: "pack"; packId: string } | { kind: "plan"; planId: string };
  promoCode?: string | null;
  /** Montant affiché au client (centimes) : contrôlé avant paiement. */
  expectedAmountCents: number;
  onDone: () => void;
  onError: (message: string) => void;
};

/** Paiement PayPal (packs de crédits et abonnements mensuels). */
export function PaypalCheckout({ target, promoCode, expectedAmountCents, onDone, onError }: Props) {
  const fetchConfig = useServerFn(getPaypalConfig);
  const createOrder = useServerFn(createPaypalOrder);
  const captureOrder = useServerFn(capturePaypalOrder);
  const fetchPlan = useServerFn(getPaypalPlan);
  const activate = useServerFn(activatePaypalSubscription);
  const [busy, setBusy] = useState(false);

  const config = useQuery({ queryKey: ["paypal-config"], queryFn: () => fetchConfig() });

  if (config.isPending) {
    return <p className="text-sm text-muted-foreground">Chargement du paiement…</p>;
  }
  if (!config.data?.clientId) {
    return <p className="text-sm text-destructive">Le paiement n'est pas disponible.</p>;
  }

  const isPlan = target.kind === "plan";

  return (
    <PayPalScriptProvider
      options={{
        clientId: config.data.clientId,
        currency: "EUR",
        intent: isPlan ? "subscription" : "capture",
        ...(isPlan ? { vault: true } : {}),
        components: "buttons",
      }}
    >
      <PayPalButtons
        key={`${target.kind}-${isPlan ? target.planId : target.packId}-${promoCode ?? ""}`}
        disabled={busy}
        style={{ layout: "vertical", shape: "pill", label: isPlan ? "subscribe" : "pay" }}
        {...(isPlan
          ? {
              createSubscription: async (_d, actions) => {
                const r = await fetchPlan({
                  data: { planId: target.planId, promoCode: promoCode ?? null },
                });
                if (!r.ok) throw new Error(r.error);
                if (Math.abs(r.amountCents - expectedAmountCents) > 1) {
                  throw new Error("Le montant affiché ne correspond pas au montant à débiter.");
                }
                return actions.subscription.create({ plan_id: r.planId });
              },
              onApprove: async (dataApprove) => {
                setBusy(true);
                try {
                  const r = await activate({
                    data: {
                      subscriptionId: String(dataApprove.subscriptionID ?? ""),
                      planId: target.planId,
                      promoCode: promoCode ?? null,
                    },
                  });
                  if (!r.ok) onError(r.error);
                  else onDone();
                } finally {
                  setBusy(false);
                }
              },
            }
          : {
              createOrder: async () => {
                const r = await createOrder({
                  data: { packId: target.packId, promoCode: promoCode ?? null },
                });
                if (!r.ok) throw new Error(r.error);
                if (Math.abs(r.amountCents - expectedAmountCents) > 1) {
                  throw new Error("Le montant affiché ne correspond pas au montant à débiter.");
                }
                return r.orderId;
              },
              onApprove: async (dataApprove) => {
                setBusy(true);
                try {
                  const r = await captureOrder({
                    data: {
                      orderId: String(dataApprove.orderID ?? ""),
                      packId: target.packId,
                      promoCode: promoCode ?? null,
                    },
                  });
                  if (!r.ok) onError(r.error);
                  else onDone();
                } finally {
                  setBusy(false);
                }
              },
            })}
        onError={(err) => onError((err as unknown as Error)?.message || "Paiement interrompu.")}
      />
    </PayPalScriptProvider>
  );
}
