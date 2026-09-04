import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";

import { createCheckoutSession } from "@/lib/payments.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";

type Props = {
  priceId: string;
  promoCode?: string | null;
  returnUrl?: string;
};

export function StripeEmbeddedCheckout({ priceId, promoCode, returnUrl }: Props) {
  const createSession = useServerFn(createCheckoutSession);

  const checkoutOptions = useMemo(
    () => ({
      fetchClientSecret: async (): Promise<string> => {
        const result = await createSession({
          data: {
            priceId,
            ...(promoCode ? { promoCode } : {}),
            returnUrl: returnUrl ?? `${window.location.origin}/pricing?checkout=done`,
            environment: getStripeEnvironment(),
          },
        });
        if ("error" in result) throw new Error(result.error);
        if (!result.clientSecret) throw new Error("Stripe n'a pas renvoyé de session");
        return result.clientSecret;
      },
    }),
    // Une seule session par montage : la clé ne doit pas changer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [priceId, promoCode, returnUrl],
  );

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={checkoutOptions}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
