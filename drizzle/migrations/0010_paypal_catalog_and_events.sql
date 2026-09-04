CREATE TABLE IF NOT EXISTS public.paypal_catalog (
  key text PRIMARY KEY,
  paypal_id text NOT NULL,
  amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.paypal_catalog TO service_role;
ALTER TABLE public.paypal_catalog ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.paypal_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.paypal_events TO service_role;
ALTER TABLE public.paypal_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.paypal_subscription_owners (
  paypal_subscription_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL,
  amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.paypal_subscription_owners TO service_role;
ALTER TABLE public.paypal_subscription_owners ENABLE ROW LEVEL SECURITY;