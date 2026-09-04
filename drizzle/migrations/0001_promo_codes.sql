-- 1. Rôle admin uniquement pour ilyanpupin@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE lower(email) = 'ilyanpupin@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Si ce compte est recréé plus tard, il reçoit à nouveau le rôle admin
CREATE OR REPLACE FUNCTION public.grant_owner_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'ilyanpupin@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

-- 2. Codes de promotion
CREATE TABLE IF NOT EXISTS public.promo_codes (
  code text PRIMARY KEY,
  percent_off integer NOT NULL CHECK (percent_off >= 0 AND percent_off <= 100),
  active boolean NOT NULL DEFAULT true,
  uses integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read promo codes" ON public.promo_codes;
CREATE POLICY "Admins read promo codes" ON public.promo_codes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. Fonctions
CREATE OR REPLACE FUNCTION public.promo_lookup(_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO c FROM promo_codes WHERE code = upper(btrim(_code)) AND active;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;
  RETURN jsonb_build_object('ok', true, 'code', c.code, 'percentOff', c.percent_off);
END $$;

CREATE OR REPLACE FUNCTION public.promo_create(_code text, _percent integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c text := upper(btrim(_code));
BEGIN
  IF _uid IS NULL OR NOT has_role(_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _c = '' OR length(_c) > 32 THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF _percent < 0 OR _percent > 100 THEN RAISE EXCEPTION 'invalid_percent'; END IF;
  INSERT INTO promo_codes (code, percent_off, created_by) VALUES (_c, _percent, _uid)
  ON CONFLICT (code) DO UPDATE SET percent_off = EXCLUDED.percent_off, active = true;
  RETURN jsonb_build_object('code', _c, 'percentOff', _percent);
END $$;

CREATE OR REPLACE FUNCTION public.promo_delete(_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT has_role(_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM promo_codes WHERE code = upper(btrim(_code));
END $$;

REVOKE ALL ON FUNCTION public.promo_lookup(text) FROM public;
REVOKE ALL ON FUNCTION public.promo_create(text, integer) FROM public;
REVOKE ALL ON FUNCTION public.promo_delete(text) FROM public;
GRANT EXECUTE ON FUNCTION public.promo_lookup(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promo_create(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promo_delete(text) TO authenticated;

-- 4. Achats fictifs avec code promo
CREATE OR REPLACE FUNCTION public.fake_subscribe(_plan_id text, _promo_code text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); p record; w record; pc record; price integer; note text;
BEGIN
  IF _uid IS NULL OR NOT has_role(_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM billing_ensure(_uid);
  SELECT * INTO p FROM plans WHERE id = _plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown plan'; END IF;
  price := p.price_cents;
  note := p.name;
  IF _promo_code IS NOT NULL AND btrim(_promo_code) <> '' THEN
    SELECT * INTO pc FROM promo_codes WHERE code = upper(btrim(_promo_code)) AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_promo'; END IF;
    price := round(price * (100 - pc.percent_off) / 100.0);
    note := note || ' · ' || pc.code || ' −' || pc.percent_off || '%';
    UPDATE promo_codes SET uses = uses + 1 WHERE code = pc.code;
  END IF;
  SELECT * INTO w FROM credit_wallets WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(w.fake_balance_cents, 0) < price THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  UPDATE credit_wallets SET fake_balance_cents = fake_balance_cents - price WHERE user_id = _uid;
  INSERT INTO user_subscriptions (user_id, plan_id, status, mode, monthly_credits_remaining, current_period_start, renews_at)
    VALUES (_uid, p.id, 'active', 'test', p.monthly_credits, now(), now() + interval '1 month')
    ON CONFLICT (user_id) DO UPDATE SET plan_id = EXCLUDED.plan_id, status = 'active', mode = 'test',
      monthly_credits_remaining = EXCLUDED.monthly_credits_remaining, current_period_start = now(), renews_at = now() + interval '1 month';
  INSERT INTO credit_transactions (user_id, kind, credits, amount_cents, mode, note)
    VALUES (_uid, 'subscription', p.monthly_credits, price, 'test', note);
END $$;

CREATE OR REPLACE FUNCTION public.fake_buy_pack(_pack_id text, _promo_code text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); k record; w record; pc record; price integer; subscribed boolean; note text;
BEGIN
  IF _uid IS NULL OR NOT has_role(_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM billing_ensure(_uid);
  SELECT * INTO k FROM credit_packs WHERE id = _pack_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown pack'; END IF;
  subscribed := EXISTS (SELECT 1 FROM user_subscriptions WHERE user_id = _uid AND status = 'active');
  price := CASE WHEN subscribed THEN round(k.price_cents * 0.8) ELSE k.price_cents END;
  note := k.credits || ' crédits';
  IF _promo_code IS NOT NULL AND btrim(_promo_code) <> '' THEN
    SELECT * INTO pc FROM promo_codes WHERE code = upper(btrim(_promo_code)) AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_promo'; END IF;
    price := round(price * (100 - pc.percent_off) / 100.0);
    note := note || ' · ' || pc.code || ' −' || pc.percent_off || '%';
    UPDATE promo_codes SET uses = uses + 1 WHERE code = pc.code;
  END IF;
  SELECT * INTO w FROM credit_wallets WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(w.fake_balance_cents, 0) < price THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  UPDATE credit_wallets SET fake_balance_cents = fake_balance_cents - price, purchased_credits = purchased_credits + k.credits WHERE user_id = _uid;
  INSERT INTO credit_transactions (user_id, kind, credits, amount_cents, mode, note)
    VALUES (_uid, 'pack', k.credits, price, 'test', note);
END $$;