-- Colonnes Stripe sur l'abonnement
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS user_subscriptions_stripe_sub_idx
  ON public.user_subscriptions (stripe_subscription_id);

-- Idempotence des webhooks
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.stripe_events TO service_role;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- aucune policy : accessible uniquement au service_role (webhook)

-- Applique un abonnement payé (création, renouvellement, changement de formule)
CREATE OR REPLACE FUNCTION public.stripe_apply_subscription(
  _user_id uuid,
  _plan_id text,
  _mode text,
  _stripe_customer_id text,
  _stripe_subscription_id text,
  _stripe_price_id text,
  _period_start timestamptz,
  _renews_at timestamptz,
  _cancel_at_period_end boolean,
  _amount_cents integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p record; prev record; delta integer := 0; new_remaining integer;
BEGIN
  PERFORM billing_ensure(_user_id);
  SELECT * INTO p FROM plans WHERE id = _plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_plan'; END IF;

  SELECT * INTO prev FROM user_subscriptions WHERE user_id = _user_id FOR UPDATE;

  IF FOUND
     AND prev.stripe_subscription_id = _stripe_subscription_id
     AND prev.current_period_start = _period_start THEN
    -- même période : changement de formule -> on ajoute la différence de quota
    delta := GREATEST(0, p.monthly_credits - COALESCE(prev.monthly_credits, p.monthly_credits));
    new_remaining := COALESCE(prev.monthly_credits_remaining, 0)
      + GREATEST(0, p.monthly_credits - COALESCE((SELECT monthly_credits FROM plans WHERE id = prev.plan_id), 0));
  ELSE
    -- nouvelle période ou nouvel abonnement : quota complet
    new_remaining := p.monthly_credits;
  END IF;

  INSERT INTO user_subscriptions (
    user_id, plan_id, status, mode, monthly_credits_remaining,
    current_period_start, renews_at, stripe_customer_id, stripe_subscription_id,
    stripe_price_id, cancel_at_period_end, updated_at
  ) VALUES (
    _user_id, _plan_id, 'active', _mode, new_remaining,
    _period_start, _renews_at, _stripe_customer_id, _stripe_subscription_id,
    _stripe_price_id, COALESCE(_cancel_at_period_end, false), now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = 'active',
    mode = EXCLUDED.mode,
    monthly_credits_remaining = EXCLUDED.monthly_credits_remaining,
    current_period_start = EXCLUDED.current_period_start,
    renews_at = EXCLUDED.renews_at,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    stripe_price_id = EXCLUDED.stripe_price_id,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    updated_at = now();

  INSERT INTO credit_transactions (user_id, kind, credits, amount_cents, mode, note)
  VALUES (_user_id, 'subscription', new_remaining, COALESCE(_amount_cents, 0), _mode,
          'Abonnement ' || p.name);
END $$;

-- Ajoute les crédits d'un pack acheté
CREATE OR REPLACE FUNCTION public.stripe_apply_pack(
  _user_id uuid,
  _pack_id text,
  _mode text,
  _amount_cents integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k record;
BEGIN
  PERFORM billing_ensure(_user_id);
  SELECT * INTO k FROM credit_packs WHERE id = _pack_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_pack'; END IF;
  UPDATE credit_wallets SET purchased_credits = purchased_credits + k.credits, updated_at = now()
    WHERE user_id = _user_id;
  INSERT INTO credit_transactions (user_id, kind, credits, amount_cents, mode, note)
  VALUES (_user_id, 'pack', k.credits, COALESCE(_amount_cents, 0), _mode,
          'Pack ' || k.credits || ' crédits');
END $$;

-- Résiliation : accès conservé jusqu'à la fin de la période payée
CREATE OR REPLACE FUNCTION public.stripe_mark_cancel_at_period_end(
  _stripe_subscription_id text,
  _cancel boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE user_subscriptions
     SET cancel_at_period_end = COALESCE(_cancel, false), updated_at = now()
   WHERE stripe_subscription_id = _stripe_subscription_id;
END $$;

-- Fin définitive de l'abonnement (période écoulée)
CREATE OR REPLACE FUNCTION public.stripe_end_subscription(
  _stripe_subscription_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE user_subscriptions
     SET status = 'canceled', monthly_credits_remaining = 0, updated_at = now()
   WHERE stripe_subscription_id = _stripe_subscription_id;
END $$;

REVOKE ALL ON FUNCTION public.stripe_apply_subscription(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.stripe_apply_pack(uuid, text, text, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.stripe_mark_cancel_at_period_end(text, boolean) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.stripe_end_subscription(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stripe_apply_subscription(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_apply_pack(uuid, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_mark_cancel_at_period_end(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_end_subscription(text) TO service_role;