-- Résiliation : l'abonnement reste actif (crédits + avantages) jusqu'à la fin
-- de la période payée ; les crédits ne sont retirés qu'à cette date.

CREATE OR REPLACE FUNCTION public.fake_cancel()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT has_role(_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE user_subscriptions
     SET cancel_at_period_end = true, updated_at = now()
   WHERE user_id = _uid AND status = 'active';
  INSERT INTO credit_transactions (user_id, kind, credits, mode, note)
  VALUES (_uid, 'cancel', 0, 'test', 'Abonnement annulé — accès conservé jusqu''à la fin de la période');
END $function$;

-- À l'échéance : renouvellement seulement si l'abonnement n'est pas résilié.
CREATE OR REPLACE FUNCTION public.billing_ensure(_uid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s record; p record; is_admin boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM credit_wallets WHERE user_id = _uid) THEN
    INSERT INTO credit_wallets (user_id, purchased_credits) VALUES (_uid, 10);
    INSERT INTO credit_transactions (user_id, kind, credits, mode, note) VALUES (_uid, 'welcome', 10, 'live', 'Crédits de bienvenue');
  END IF;
  is_admin := has_role(_uid, 'admin');
  IF is_admin THEN
    UPDATE credit_wallets SET fake_balance_cents = 100000000 WHERE user_id = _uid AND fake_balance_cents IS NULL;
  END IF;
  SELECT * INTO s FROM user_subscriptions WHERE user_id = _uid AND status = 'active';
  IF FOUND AND s.renews_at <= now() THEN
    IF s.cancel_at_period_end THEN
      -- La période payée est terminée : fin réelle de l'abonnement.
      UPDATE user_subscriptions
         SET status = 'canceled', monthly_credits_remaining = 0, updated_at = now()
       WHERE user_id = _uid;
      INSERT INTO credit_transactions (user_id, kind, credits, mode, note)
      VALUES (_uid, 'cancel_effective', 0, s.mode, 'Fin de la période payée');
    ELSE
      SELECT * INTO p FROM plans WHERE id = s.plan_id;
      WHILE s.renews_at <= now() LOOP
        s.renews_at := s.renews_at + interval '1 month';
      END LOOP;
      UPDATE user_subscriptions SET monthly_credits_remaining = p.monthly_credits,
        current_period_start = s.renews_at - interval '1 month', renews_at = s.renews_at
        WHERE user_id = _uid;
      INSERT INTO credit_transactions (user_id, kind, credits, mode, note) VALUES (_uid, 'renewal', p.monthly_credits, s.mode, p.name);
    END IF;
  END IF;
END $function$;

-- Expose l'état de résiliation à l'application.
CREATE OR REPLACE FUNCTION public.billing_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); w record; s record; p record; is_admin boolean; plan_json jsonb := NULL;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM billing_ensure(_uid);
  is_admin := has_role(_uid, 'admin');
  SELECT * INTO w FROM credit_wallets WHERE user_id = _uid;
  SELECT * INTO s FROM user_subscriptions WHERE user_id = _uid AND status = 'active';
  IF FOUND THEN
    SELECT * INTO p FROM plans WHERE id = s.plan_id;
    IF FOUND THEN
      plan_json := jsonb_build_object(
        'id', p.id, 'name', p.name, 'priceCents', p.price_cents, 'monthlyCredits', p.monthly_credits,
        'allowAdvanced', p.allow_advanced, 'allowAllThemes', p.allow_all_themes, 'allowImportMusic', p.allow_import_music,
        'renewsAt', s.renews_at, 'periodStart', s.current_period_start, 'mode', s.mode,
        'cancelAtPeriodEnd', s.cancel_at_period_end);
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'isAdmin', is_admin,
    'fakeBalanceCents', w.fake_balance_cents,
    'purchasedCredits', w.purchased_credits,
    'monthlyCredits', COALESCE(s.monthly_credits_remaining, 0),
    'plan', plan_json
  );
END $function$;

-- Fin réelle côté Stripe : ne retirer les crédits que si la période est écoulée.
CREATE OR REPLACE FUNCTION public.stripe_end_subscription(_stripe_subscription_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM user_subscriptions WHERE stripe_subscription_id = _stripe_subscription_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF s.renews_at > now() THEN
    -- Période encore en cours : on marque seulement la résiliation.
    UPDATE user_subscriptions
       SET cancel_at_period_end = true, updated_at = now()
     WHERE stripe_subscription_id = _stripe_subscription_id;
  ELSE
    UPDATE user_subscriptions
       SET status = 'canceled', monthly_credits_remaining = 0, cancel_at_period_end = true, updated_at = now()
     WHERE stripe_subscription_id = _stripe_subscription_id;
  END IF;
END $function$;
