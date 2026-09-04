CREATE OR REPLACE FUNCTION public.promo_set_active(_code text, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT has_role(_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE promo_codes SET active = _active WHERE code = upper(btrim(_code));
END $$;

REVOKE ALL ON FUNCTION public.promo_set_active(text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.promo_set_active(text, boolean) TO authenticated;