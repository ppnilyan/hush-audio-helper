-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Plans
CREATE TABLE public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_cents integer NOT NULL,
  monthly_credits integer NOT NULL,
  allow_advanced boolean NOT NULL DEFAULT false,
  allow_all_themes boolean NOT NULL DEFAULT false,
  allow_import_music boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans are public" ON public.plans FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.plans (id, name, price_cents, monthly_credits, allow_advanced, allow_all_themes, allow_import_music, sort_order) VALUES
  ('starter', 'Starter', 1700, 300, false, false, false, 1),
  ('pro', 'Pro', 2700, 600, true, true, true, 2),
  ('elite', 'Elite', 4700, 1500, true, true, true, 3);

-- Credit packs
CREATE TABLE public.credit_packs (
  id text PRIMARY KEY,
  credits integer NOT NULL,
  price_cents integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_packs TO anon, authenticated;
GRANT ALL ON public.credit_packs TO service_role;
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packs are public" ON public.credit_packs FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.credit_packs (id, credits, price_cents, sort_order) VALUES
  ('pack50', 50, 690, 1),
  ('pack100', 100, 1290, 2),
  ('pack300', 300, 3490, 3);

-- Wallets
CREATE TABLE public.credit_wallets (
  user_id uuid PRIMARY KEY,
  purchased_credits integer NOT NULL DEFAULT 0,
  fake_balance_cents bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_wallets TO authenticated;
GRANT ALL ON public.credit_wallets TO service_role;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own wallet" ON public.credit_wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER credit_wallets_updated_at BEFORE UPDATE ON public.credit_wallets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Subscriptions
CREATE TABLE public.user_subscriptions (
  user_id uuid PRIMARY KEY,
  plan_id text NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'active',
  mode text NOT NULL DEFAULT 'test',
  monthly_credits_remaining integer NOT NULL DEFAULT 0,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  renews_at timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own subscription" ON public.user_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER user_subscriptions_updated_at BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Transactions
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  credits integer NOT NULL DEFAULT 0,
  amount_cents integer NOT NULL DEFAULT 0,
  mode text NOT NULL DEFAULT 'test',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_transactions_user_idx ON public.credit_transactions (user_id, created_at DESC);
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own transactions" ON public.credit_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Ensure wallet (welcome credits) + monthly renewal
CREATE OR REPLACE FUNCTION public.billing_ensure(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    SELECT * INTO p FROM plans WHERE id = s.plan_id;
    WHILE s.renews_at <= now() LOOP
      s.renews_at := s.renews_at + interval '1 month';
    END LOOP;
    UPDATE user_subscriptions SET monthly_credits_remaining = p.monthly_credits,
      current_period_start = s.renews_at - interval '1 month', renews_at = s.renews_at
      WHERE user_id = _uid;
    INSERT INTO credit_transactions (user_id, kind, credits, mode, note) VALUES (_uid, 'renewal', p.monthly_credits, s.mode, p.name);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.billing_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); w record; s record; p record; is_admin boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM billing_ensure(_uid);
  is_admin := has_role(_uid, 'admin');
  SELECT * INTO w FROM credit_wallets WHERE user_id = _uid;
  SELECT * INTO s FROM user_subscriptions WHERE user_id = _uid AND status = 'active';
  IF FOUND THEN SELECT * INTO p FROM plans WHERE id = s.plan_id; END IF;
  RETURN jsonb_build_object(
    'isAdmin', is_admin,
    'fakeBalanceCents', w.fake_balance_cents,
    'purchasedCredits', w.purchased_credits,
    'monthlyCredits', COALESCE(s.monthly_credits_remaining, 0),
    'plan', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', p.id, 'name', p.name, 'priceCents', p.price_cents, 'monthlyCredits', p.monthly_credits,
      'allowAdvanced', p.allow_advanced, 'allowAllThemes', p.allow_all_themes, 'allowImportMusic', p.allow_import_music,
      'renewsAt', s.renews_at, 'periodStart', s.current_period_start, 'mode', s.mode) END
  );
END $$;

CREATE OR REPLACE FUNCTION public.consume_credits(_amount integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); w record; s record; from_monthly integer := 0; from_purchased integer := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  PERFORM billing_ensure(_uid);
  SELECT * INTO w FROM credit_wallets WHERE user_id = _uid FOR UPDATE;
  SELECT * INTO s FROM user_subscriptions WHERE user_id = _uid AND status = 'active' FOR UPDATE;
  IF COALESCE(s.monthly_credits_remaining, 0) + w.purchased_credits < _amount THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;
  from_monthly := LEAST(COALESCE(s.monthly_credits_remaining, 0), _amount);
  from_purchased := _amount - from_monthly;
  IF from_monthly > 0 THEN
    UPDATE user_subscriptions SET monthly_credits_remaining = monthly_credits_remaining - from_monthly WHERE user_id = _uid;
  END IF;
  IF from_purchased > 0 THEN
    UPDATE credit_wallets SET purchased_credits = purchased_credits - from_purchased WHERE user_id = _uid;
  END IF;
  INSERT INTO credit_transactions (user_id, kind, credits, mode, note) VALUES (_uid, 'generation', -_amount, 'live', 'Génération vidéo');
  RETURN jsonb_build_object('fromMonthly', from_monthly, 'fromPurchased', from_purchased);
END $$;

CREATE OR REPLACE FUNCTION public.refund_credits(_from_monthly integer, _from_purchased integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _from_monthly < 0 OR _from_purchased < 0 OR _from_monthly + _from_purchased > 10 THEN RAISE EXCEPTION 'invalid refund'; END IF;
  IF _from_monthly > 0 THEN
    UPDATE user_subscriptions SET monthly_credits_remaining = monthly_credits_remaining + _from_monthly WHERE user_id = _uid AND status = 'active';
  END IF;
  IF _from_purchased > 0 THEN
    UPDATE credit_wallets SET purchased_credits = purchased_credits + _from_purchased WHERE user_id = _uid;
  END IF;
  INSERT INTO credit_transactions (user_id, kind, credits, mode, note) VALUES (_uid, 'refund', _from_monthly + _from_purchased, 'live', 'Génération échouée');
END $$;

CREATE OR REPLACE FUNCTION public.fake_subscribe(_plan_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); p record; w record;
BEGIN
  IF _uid IS NULL OR NOT has_role(_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM billing_ensure(_uid);
  SELECT * INTO p FROM plans WHERE id = _plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown plan'; END IF;
  SELECT * INTO w FROM credit_wallets WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(w.fake_balance_cents, 0) < p.price_cents THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  UPDATE credit_wallets SET fake_balance_cents = fake_balance_cents - p.price_cents WHERE user_id = _uid;
  INSERT INTO user_subscriptions (user_id, plan_id, status, mode, monthly_credits_remaining, current_period_start, renews_at)
    VALUES (_uid, p.id, 'active', 'test', p.monthly_credits, now(), now() + interval '1 month')
    ON CONFLICT (user_id) DO UPDATE SET plan_id = EXCLUDED.plan_id, status = 'active', mode = 'test',
      monthly_credits_remaining = EXCLUDED.monthly_credits_remaining, current_period_start = now(), renews_at = now() + interval '1 month';
  INSERT INTO credit_transactions (user_id, kind, credits, amount_cents, mode, note) VALUES (_uid, 'subscription', p.monthly_credits, p.price_cents, 'test', p.name);
END $$;

CREATE OR REPLACE FUNCTION public.fake_buy_pack(_pack_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); k record; w record; price integer; subscribed boolean;
BEGIN
  IF _uid IS NULL OR NOT has_role(_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM billing_ensure(_uid);
  SELECT * INTO k FROM credit_packs WHERE id = _pack_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown pack'; END IF;
  subscribed := EXISTS (SELECT 1 FROM user_subscriptions WHERE user_id = _uid AND status = 'active');
  price := CASE WHEN subscribed THEN round(k.price_cents * 0.8) ELSE k.price_cents END;
  SELECT * INTO w FROM credit_wallets WHERE user_id = _uid FOR UPDATE;
  IF COALESCE(w.fake_balance_cents, 0) < price THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  UPDATE credit_wallets SET fake_balance_cents = fake_balance_cents - price, purchased_credits = purchased_credits + k.credits WHERE user_id = _uid;
  INSERT INTO credit_transactions (user_id, kind, credits, amount_cents, mode, note) VALUES (_uid, 'pack', k.credits, price, 'test', k.credits || ' crédits');
END $$;

CREATE OR REPLACE FUNCTION public.fake_cancel()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT has_role(_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE user_subscriptions SET status = 'canceled', monthly_credits_remaining = 0 WHERE user_id = _uid;
  INSERT INTO credit_transactions (user_id, kind, credits, mode, note) VALUES (_uid, 'cancel', 0, 'test', 'Abonnement annulé');
END $$;

REVOKE ALL ON FUNCTION public.billing_ensure(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fake_subscribe(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fake_buy_pack(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fake_cancel() TO authenticated;