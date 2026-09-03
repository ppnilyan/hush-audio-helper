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
        'renewsAt', s.renews_at, 'periodStart', s.current_period_start, 'mode', s.mode);
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

INSERT INTO public.user_roles (user_id, role)
VALUES ('a2d0537a-6b67-4ff5-8dd3-889015c08287', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.credit_wallets SET fake_balance_cents = 100000000
WHERE user_id = 'a2d0537a-6b67-4ff5-8dd3-889015c08287' AND fake_balance_cents IS NULL;