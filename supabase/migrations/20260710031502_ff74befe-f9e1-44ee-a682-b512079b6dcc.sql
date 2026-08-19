ALTER TABLE public.payments REPLICA IDENTITY FULL;
ALTER TABLE public.fpc_codes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fpc_codes;