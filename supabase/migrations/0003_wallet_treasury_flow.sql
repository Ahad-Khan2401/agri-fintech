-- Wallet Treasury Flow

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'tx_type' AND t.typnamespace = 'public'::regnamespace AND e.enumlabel = 'withdrawal'
  ) THEN
    ALTER TYPE public.tx_type ADD VALUE 'withdrawal';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'tx_type' AND t.typnamespace = 'public'::regnamespace AND e.enumlabel = 'farmer_payout'
  ) THEN
    ALTER TYPE public.tx_type ADD VALUE 'farmer_payout';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'bank_transfer',
  account_title TEXT NOT NULL,
  iban TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  processed_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escrow_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_id UUID NOT NULL REFERENCES livestock(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES profiles(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  release_type TEXT NOT NULL CHECK (release_type IN ('initial_purchase', 'feed_milestone', 'vet_milestone', 'ops_expense', 'sale_settlement')),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON withdrawal_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escrow_releases_livestock ON escrow_releases(livestock_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escrow_releases_farmer ON escrow_releases(farmer_id, created_at DESC);

ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Withdrawal self read/write" ON withdrawal_requests;
CREATE POLICY "Withdrawal self read/write"
  ON withdrawal_requests
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Withdrawal admin read/write" ON withdrawal_requests;
CREATE POLICY "Withdrawal admin read/write"
  ON withdrawal_requests
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Escrow releases read for involved parties" ON escrow_releases;
CREATE POLICY "Escrow releases read for involved parties"
  ON escrow_releases
  FOR SELECT
  USING (
    farmer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM investments i WHERE i.livestock_id = escrow_releases.livestock_id AND i.investor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Escrow releases admin write" ON escrow_releases;
CREATE POLICY "Escrow releases admin write"
  ON escrow_releases
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
