-- Google OAuth profile bootstrap.
-- Keeps OAuth signups from landing without an app profile.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT;

DO $$
BEGIN
  IF to_regtype('public.user_role') IS NULL THEN
    CREATE TYPE public.user_role AS ENUM ('investor', 'farmer', 'admin');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Allow profile self insert'
  ) THEN
    CREATE POLICY "Allow profile self insert"
      ON public.profiles
      FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Allow profile self update'
  ) THEN
    CREATE POLICY "Allow profile self update"
      ON public.profiles
      FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role public.user_role;
BEGIN
  requested_role := (NEW.raw_user_meta_data ->> 'role')::public.user_role;

  IF requested_role IS NULL THEN
    RETURN NEW;
  END IF;

  IF requested_role = 'admin' THEN
    requested_role := 'investor';
  END IF;

  INSERT INTO public.profiles (id, role, phone, full_name, status)
  VALUES (
    NEW.id,
    requested_role,
    NEW.raw_user_meta_data ->> 'phone',
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;

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
