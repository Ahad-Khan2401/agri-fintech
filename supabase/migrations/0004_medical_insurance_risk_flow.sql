-- Medical clearance, insurance, and risk-control workflow

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'status' AND e.enumlabel = 'medical_review'
  ) THEN
    ALTER TYPE status ADD VALUE 'medical_review';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS veterinary_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  license_no TEXT,
  clinic_name TEXT,
  fee_per_animal NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'rejected')),
  risk_score NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medical_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_id UUID NOT NULL REFERENCES livestock(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES veterinary_partners(id),
  city TEXT NOT NULL,
  fee_amount NUMERIC(12,2) DEFAULT 0,
  assigned_by UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'cleared', 'rejected', 'unassigned')),
  due_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS vet_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_id UUID NOT NULL REFERENCES livestock(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES medical_assignments(id) ON DELETE SET NULL,
  vet_id UUID REFERENCES veterinary_partners(id),
  weight_kg NUMERIC(8,2),
  temperature_f NUMERIC(5,2),
  heart_rate_bpm INT,
  health_status TEXT,
  vet_notes TEXT,
  report_pdf_url TEXT,
  fit_for_investment BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected')),
  inspection_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_id UUID NOT NULL REFERENCES livestock(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL DEFAULT 'MaweshiHub Risk Pool',
  coverage_amount NUMERIC(12,2) NOT NULL,
  premium_amount NUMERIC(12,2) NOT NULL,
  covered_risks TEXT[] DEFAULT ARRAY['death', 'disease', 'theft'],
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE DEFAULT (CURRENT_DATE + INTERVAL '180 days')::DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expired', 'claimed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_veterinary_partners_city ON veterinary_partners(city, status);
CREATE INDEX IF NOT EXISTS idx_medical_assignments_status ON medical_assignments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_assignments_livestock ON medical_assignments(livestock_id);
CREATE INDEX IF NOT EXISTS idx_vet_reports_livestock ON vet_reports(livestock_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_livestock ON insurance_policies(livestock_id, status);

ALTER TABLE veterinary_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vet_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin veterinary partner access" ON veterinary_partners;
CREATE POLICY "Admin veterinary partner access" ON veterinary_partners
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Medical assignment admin access" ON medical_assignments;
CREATE POLICY "Medical assignment admin access" ON medical_assignments
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Medical assignment farmer read" ON medical_assignments;
CREATE POLICY "Medical assignment farmer read" ON medical_assignments
  FOR SELECT USING (farmer_id = auth.uid());

DROP POLICY IF EXISTS "Vet reports public involved read" ON vet_reports;
CREATE POLICY "Vet reports public involved read" ON vet_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM livestock WHERE id = vet_reports.livestock_id AND (status = 'active' OR farmer_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM investments WHERE livestock_id = vet_reports.livestock_id AND investor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Vet reports admin write" ON vet_reports;
CREATE POLICY "Vet reports admin write" ON vet_reports
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Insurance policies involved read" ON insurance_policies;
CREATE POLICY "Insurance policies involved read" ON insurance_policies
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM livestock WHERE id = insurance_policies.livestock_id AND (status = 'active' OR farmer_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM investments WHERE livestock_id = insurance_policies.livestock_id AND investor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Insurance policies admin write" ON insurance_policies;
CREATE POLICY "Insurance policies admin write" ON insurance_policies
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
