-- Doctor self-onboarding + taxi-style medical dispatch compatibility.

ALTER TABLE public.veterinary_partners
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS experience_years integer,
  ADD COLUMN IF NOT EXISTS qualification text,
  ADD COLUMN IF NOT EXISTS document_url text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

ALTER TABLE public.medical_assignments
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'veterinary_partners_status_check'
      AND conrelid = 'public.veterinary_partners'::regclass
  ) THEN
    ALTER TABLE public.veterinary_partners DROP CONSTRAINT veterinary_partners_status_check;
  END IF;

  ALTER TABLE public.veterinary_partners
    ADD CONSTRAINT veterinary_partners_status_check
    CHECK (status IN ('pending','active','approved','inactive','suspended'));
END $$;

CREATE INDEX IF NOT EXISTS idx_veterinary_partners_dispatch
  ON public.veterinary_partners(city, area, status);

CREATE INDEX IF NOT EXISTS idx_medical_assignments_dispatch
  ON public.medical_assignments(city, area, status, doctor_id);

DROP POLICY IF EXISTS "Public doctor onboarding insert" ON public.veterinary_partners;
CREATE POLICY "Public doctor onboarding insert"
ON public.veterinary_partners
FOR INSERT
WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS "Public active doctor lookup" ON public.veterinary_partners;
CREATE POLICY "Public active doctor lookup"
ON public.veterinary_partners
FOR SELECT
USING (status IN ('active','approved'));

DROP POLICY IF EXISTS "Doctor open assignment read" ON public.medical_assignments;
CREATE POLICY "Doctor open assignment read"
ON public.medical_assignments
FOR SELECT
USING (status IN ('unassigned','pending') OR doctor_id IS NOT NULL);

DROP POLICY IF EXISTS "Doctor first accept assignment" ON public.medical_assignments;
CREATE POLICY "Doctor first accept assignment"
ON public.medical_assignments
FOR UPDATE
USING (doctor_id IS NULL AND status IN ('unassigned','pending'))
WITH CHECK (doctor_id IS NOT NULL AND status = 'pending');
