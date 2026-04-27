-- Smooth Google/email signup bootstrap for existing production schema.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text;

ALTER TABLE public.wallets
  ALTER COLUMN user_id SET NOT NULL;

DROP POLICY IF EXISTS "Allow profile self insert" ON public.profiles;
CREATE POLICY "Allow profile self insert"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow profile self update" ON public.profiles;
CREATE POLICY "Allow profile self update"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow wallet self insert" ON public.wallets;
CREATE POLICY "Allow wallet self insert"
ON public.wallets
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role user_role;
BEGIN
  requested_role := COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'investor'::user_role);

  IF requested_role = 'admin' THEN
    requested_role := 'investor';
  END IF;

  INSERT INTO public.profiles (id, role, full_name, phone, phone_verified, status)
  VALUES (
    NEW.id,
    requested_role,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'phone',
    false,
    'pending'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    updated_at = now();

  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
