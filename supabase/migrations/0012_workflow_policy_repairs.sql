-- RLS and state repair for admin approval and medical lifecycle actions.

DROP POLICY IF EXISTS "Livestock admin full access" ON public.livestock;
CREATE POLICY "Livestock admin full access"
  ON public.livestock
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Livestock farmer insert own" ON public.livestock;
CREATE POLICY "Livestock farmer insert own"
  ON public.livestock
  FOR INSERT
  WITH CHECK (
    farmer_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'farmer' AND status = 'approved')
  );

DROP POLICY IF EXISTS "Livestock farmer update own draft" ON public.livestock;
CREATE POLICY "Livestock farmer update own draft"
  ON public.livestock
  FOR UPDATE
  USING (farmer_id = auth.uid() AND status IN ('draft', 'rejected'))
  WITH CHECK (farmer_id = auth.uid());

DROP POLICY IF EXISTS "KYC admin update" ON public.kyc_documents;
CREATE POLICY "KYC admin update"
  ON public.kyc_documents
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "KYC admin select" ON public.kyc_documents;
CREATE POLICY "KYC admin select"
  ON public.kyc_documents
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DO $$
BEGIN
  ALTER TABLE public.livestock DISABLE TRIGGER USER;

  UPDATE public.livestock l
  SET status = 'active', updated_at = now()
  FROM public.medical_assignments ma
  WHERE ma.livestock_id = l.id
    AND ma.status = 'cleared'
    AND l.status <> 'active';

  UPDATE public.livestock l
  SET status = 'rejected', updated_at = now()
  FROM public.medical_assignments ma
  WHERE ma.livestock_id = l.id
    AND ma.status = 'rejected'
    AND l.status <> 'rejected';

  ALTER TABLE public.livestock ENABLE TRIGGER USER;
EXCEPTION WHEN OTHERS THEN
  ALTER TABLE public.livestock ENABLE TRIGGER USER;
  RAISE;
END $$;

NOTIFY pgrst, 'reload schema';
