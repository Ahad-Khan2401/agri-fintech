-- Prevent first-time Google login from silently becoming an investor.
-- The app creates OAuth profiles after Signup stores the chosen one-time role.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
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
