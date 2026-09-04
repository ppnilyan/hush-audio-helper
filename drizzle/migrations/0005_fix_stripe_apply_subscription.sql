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
DECLARE p record; prev record; prev_quota integer := 0; new_remaining integer;
BEGIN
  PERFORM billing_ensure(_user_id);
  SELECT * INTO p FROM plans WHERE id = _plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_plan'; END IF;

  SELECT * INTO prev FROM user_subscriptions WHERE user_id = _user_id FOR UPDATE;

  IF FOUND
     AND prev.stripe_subscription_id = _stripe_subscription_id
     AND prev.current_period_start = _period_start THEN
    SELECT COALESCE(monthly_credits, 0) INTO prev_quota FROM plans WHERE id = prev.plan_id;
    new_remaining := COALESCE(prev.monthly_credits_remaining, 0)
      + GREATEST(0, p.monthly_credits - COALESCE(prev_quota, 0));
  ELSE
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