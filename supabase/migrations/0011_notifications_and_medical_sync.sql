-- Product workflow guarantees: user notifications and medical status sync.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications self read" ON public.notifications;
CREATE POLICY "Notifications self read"
  ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Notifications self update" ON public.notifications;
CREATE POLICY "Notifications self update"
  ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Notifications admin write" ON public.notifications;
CREATE POLICY "Notifications admin write"
  ON public.notifications
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE OR REPLACE FUNCTION public.notify_profile_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications (user_id, type, title, message, metadata)
      VALUES (
        NEW.id,
        'kyc_approved',
        'KYC approved',
        'Your account is verified. Dashboard features are now unlocked.',
        jsonb_build_object('role', NEW.role)
      );
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, type, title, message, metadata)
      VALUES (
        NEW.id,
        'kyc_rejected',
        'KYC needs correction',
        'Admin rejected your KYC. Please review notes and resubmit documents.',
        jsonb_build_object('role', NEW.role)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_profile_status_change ON public.profiles;
CREATE TRIGGER trg_notify_profile_status_change
  AFTER UPDATE OF status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_profile_status_change();

CREATE OR REPLACE FUNCTION public.sync_livestock_from_medical_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_farmer_id uuid;
  v_title text;
BEGIN
  IF NEW.status = 'cleared' THEN
    UPDATE public.livestock
    SET status = 'active', updated_at = now()
    WHERE id = NEW.livestock_id
    RETURNING farmer_id, title INTO v_farmer_id, v_title;

    IF v_farmer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, metadata)
      VALUES (
        v_farmer_id,
        'medical_cleared',
        'Livestock medically cleared',
        COALESCE(v_title, 'Your livestock') || ' is now active for investors.',
        jsonb_build_object('livestock_id', NEW.livestock_id, 'assignment_id', NEW.id)
      );
    END IF;
  ELSIF NEW.status = 'rejected' THEN
    UPDATE public.livestock
    SET status = 'rejected', updated_at = now()
    WHERE id = NEW.livestock_id
    RETURNING farmer_id, title INTO v_farmer_id, v_title;

    IF v_farmer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, metadata)
      VALUES (
        v_farmer_id,
        'medical_rejected',
        'Livestock medical review rejected',
        COALESCE(v_title, 'Your livestock') || ' was rejected after medical review.',
        jsonb_build_object('livestock_id', NEW.livestock_id, 'assignment_id', NEW.id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_livestock_from_medical_assignment ON public.medical_assignments;
CREATE TRIGGER trg_sync_livestock_from_medical_assignment
  AFTER INSERT OR UPDATE OF status ON public.medical_assignments
  FOR EACH ROW
  WHEN (NEW.status IN ('cleared', 'rejected'))
  EXECUTE FUNCTION public.sync_livestock_from_medical_assignment();

CREATE OR REPLACE FUNCTION public.sync_livestock_from_vet_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' OR NEW.fit_for_investment = true THEN
    UPDATE public.medical_assignments
    SET status = 'cleared', completed_at = COALESCE(completed_at, now())
    WHERE id = NEW.assignment_id;

    UPDATE public.livestock
    SET status = 'active', updated_at = now()
    WHERE id = NEW.livestock_id;
  ELSIF NEW.status = 'rejected' THEN
    UPDATE public.medical_assignments
    SET status = 'rejected', completed_at = COALESCE(completed_at, now())
    WHERE id = NEW.assignment_id;

    UPDATE public.livestock
    SET status = 'rejected', updated_at = now()
    WHERE id = NEW.livestock_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_livestock_from_vet_report ON public.vet_reports;
CREATE TRIGGER trg_sync_livestock_from_vet_report
  AFTER INSERT OR UPDATE OF status, fit_for_investment ON public.vet_reports
  FOR EACH ROW EXECUTE FUNCTION public.sync_livestock_from_vet_report();

NOTIFY pgrst, 'reload schema';
