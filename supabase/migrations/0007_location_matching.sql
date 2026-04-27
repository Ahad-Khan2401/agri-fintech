-- Location matching improvement: standardized city/area fields.

ALTER TABLE public.livestock
  ADD COLUMN IF NOT EXISTS area text;

ALTER TABLE public.veterinary_partners
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS experience_years integer,
  ADD COLUMN IF NOT EXISTS qualification text,
  ADD COLUMN IF NOT EXISTS document_url text;

ALTER TABLE public.medical_assignments
  ADD COLUMN IF NOT EXISTS area text;

CREATE INDEX IF NOT EXISTS idx_livestock_location_area
  ON public.livestock(location_city, area);

CREATE INDEX IF NOT EXISTS idx_veterinary_partners_location_area
  ON public.veterinary_partners(city, area, status);

CREATE INDEX IF NOT EXISTS idx_medical_assignments_location_area
  ON public.medical_assignments(city, area, status);

NOTIFY pgrst, 'reload schema';
