
-- referrals: explicit deny for client-side INSERT/UPDATE/DELETE
CREATE POLICY "Block client inserts on referrals" ON public.referrals FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "Block client updates on referrals" ON public.referrals FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "Block client deletes on referrals" ON public.referrals FOR DELETE TO authenticated, anon USING (false);

-- transactions: explicit deny for client-side INSERT/UPDATE/DELETE
CREATE POLICY "Block client inserts on transactions" ON public.transactions FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "Block client updates on transactions" ON public.transactions FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "Block client deletes on transactions" ON public.transactions FOR DELETE TO authenticated, anon USING (false);

-- ad_completions: add explicit deny for UPDATE/DELETE (INSERT already blocked)
CREATE POLICY "Block client updates on ad_completions" ON public.ad_completions FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "Block client deletes on ad_completions" ON public.ad_completions FOR DELETE TO authenticated, anon USING (false);
