
UPDATE auth.users
SET encrypted_password = crypt('Warzone001.', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'farmonie96@gmail.com';

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'farmonie96@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
