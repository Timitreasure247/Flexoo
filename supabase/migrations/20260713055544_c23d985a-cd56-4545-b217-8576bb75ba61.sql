
CREATE TABLE public.community_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  platform text NOT NULL DEFAULT 'custom',
  url text NOT NULL,
  icon text,
  member_count text,
  status text NOT NULL DEFAULT 'active',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.community_channels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_channels TO authenticated;
GRANT ALL ON public.community_channels TO service_role;

ALTER TABLE public.community_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active channels"
  ON public.community_channels FOR SELECT
  USING (status = 'active' OR public.is_current_user_admin());

CREATE POLICY "Admins can insert channels"
  ON public.community_channels FOR INSERT
  TO authenticated
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can update channels"
  ON public.community_channels FOR UPDATE
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "Admins can delete channels"
  ON public.community_channels FOR DELETE
  TO authenticated
  USING (public.is_current_user_admin());

CREATE TRIGGER update_community_channels_updated_at
  BEFORE UPDATE ON public.community_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.community_channels REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_channels;
