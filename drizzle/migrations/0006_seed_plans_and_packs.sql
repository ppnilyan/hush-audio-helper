INSERT INTO public.plans (id, name, price_cents, monthly_credits, allow_advanced, allow_all_themes, allow_import_music, sort_order) VALUES
  ('starter', 'Starter', 1700, 300, false, false, false, 1),
  ('pro', 'Pro', 2700, 600, true, true, true, 2),
  ('elite', 'Elite', 4700, 1500, true, true, true, 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  monthly_credits = EXCLUDED.monthly_credits,
  allow_advanced = EXCLUDED.allow_advanced,
  allow_all_themes = EXCLUDED.allow_all_themes,
  allow_import_music = EXCLUDED.allow_import_music,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.credit_packs (id, credits, price_cents, sort_order) VALUES
  ('pack50', 50, 690, 1),
  ('pack100', 100, 1290, 2),
  ('pack300', 300, 3490, 3)
ON CONFLICT (id) DO UPDATE SET
  credits = EXCLUDED.credits,
  price_cents = EXCLUDED.price_cents,
  sort_order = EXCLUDED.sort_order;
