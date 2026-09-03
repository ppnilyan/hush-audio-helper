REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.billing_ensure(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_state() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.consume_credits(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refund_credits(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fake_subscribe(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fake_buy_pack(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fake_cancel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;