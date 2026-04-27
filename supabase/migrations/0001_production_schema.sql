-- ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";

-- ENUM TYPES
CREATE TYPE user_role AS ENUM ('investor', 'farmer', 'admin');
CREATE TYPE status AS ENUM ('pending', 'approved', 'rejected', 'active', 'completed', 'draft', 'funded', 'in_progress', 'sold', 'loss', 'fraud');
CREATE TYPE tx_type AS ENUM ('deposit', 'investment', 'escrow_hold', 'maintenance_release', 'profit_share', 'platform_fee', 'insurance_payout', 'refund');

-- TABLES
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  phone VARCHAR(15),
  phone_verified BOOLEAN DEFAULT FALSE,
  status status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE wallets (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  main_balance NUMERIC(12,2) DEFAULT 0.00,
  escrow_locked NUMERIC(12,2) DEFAULT 0.00,
  currency CHAR(3) DEFAULT 'PKR',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES wallets(user_id) ON DELETE CASCADE,
  type tx_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  reference_id UUID,
  metadata JSONB,
  status status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE livestock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  title VARCHAR(100) NOT NULL,
  breed VARCHAR(50),
  age_months INT CHECK (age_months > 0),
  weight_kg DECIMAL(5,1) CHECK (weight_kg > 0),
  location JSONB NOT NULL,
  cost_price NUMERIC(12,2) NOT NULL CHECK (cost_price > 0),
  total_shares INT NOT NULL CHECK (total_shares > 0),
  price_per_share NUMERIC(8,2) NOT NULL,
  farmer_shares INT NOT NULL,
  shares_available INT,
  status status DEFAULT 'draft',
  insurance_enabled BOOLEAN DEFAULT FALSE,
  missing_updates INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT farmer_min_stake CHECK (farmer_shares >= CEIL(total_shares * 0.2)),
  CONSTRAINT shares_available_calc CHECK (shares_available = total_shares - farmer_shares)
);

CREATE TABLE livestock_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_id UUID REFERENCES livestock(id) ON DELETE CASCADE,
  type VARCHAR(20) CHECK (type IN ('image', 'video')),
  url TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_id UUID REFERENCES livestock(id) ON DELETE RESTRICT,
  investor_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  shares INT NOT NULL CHECK (shares > 0),
  amount NUMERIC(12,2) NOT NULL,
  ownership_percent DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE livestock_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_id UUID REFERENCES livestock(id) ON DELETE CASCADE,
  farmer_id UUID REFERENCES profiles(id),
  weight_kg DECIMAL(5,1),
  health_status VARCHAR(20),
  notes TEXT,
  media_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sale_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_id UUID REFERENCES livestock(id),
  farmer_id UUID REFERENCES profiles(id),
  proposed_price NUMERIC(12,2),
  buyer_phone VARCHAR(15),
  market_location JSONB,
  receipt_url TEXT,
  sale_video_url TEXT,
  buyer_otp_verified BOOLEAN DEFAULT FALSE,
  status status DEFAULT 'pending',
  admin_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profit_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sale_requests(id) ON DELETE CASCADE,
  investor_id UUID REFERENCES profiles(id),
  farmer_id UUID REFERENCES profiles(id),
  amount NUMERIC(12,2),
  platform_fee NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id),
  action VARCHAR(50) NOT NULL,
  target_table VARCHAR(30),
  target_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_id UUID REFERENCES livestock(id),
  flag_type VARCHAR(50),
  severity INT DEFAULT 1,
  description TEXT,
  status status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type VARCHAR(30),
  file_url TEXT,
  status status DEFAULT 'pending',
  verified_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_livestock_status ON livestock(status);
CREATE INDEX idx_livestock_farmer ON livestock(farmer_id);
CREATE INDEX idx_investments_investor ON investments(investor_id);
CREATE INDEX idx_investments_livestock ON investments(livestock_id);
CREATE INDEX idx_tx_user_type ON transactions(user_id, type);
CREATE INDEX idx_updates_livestock ON livestock_updates(livestock_id, created_at DESC);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- IMMUTABLE AUDIT TRIGGER
CREATE OR REPLACE FUNCTION log_audit_action()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (actor_id, action, target_table, target_id, details, ip_address)
    VALUES (
      current_setting('app.current_user_id', true)::UUID,
      TG_OP || '_' || TG_TABLE_NAME,
      TG_TABLE_NAME,
      (CASE WHEN TG_OP = 'INSERT' THEN NEW.id ELSE OLD.id END),
      jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)),
      current_setting('app.request_ip', true)::INET
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_audit_triggers()
RETURNS VOID AS $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name != 'audit_logs'
  LOOP
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %1$s FOR EACH ROW EXECUTE FUNCTION log_audit_action()', t.table_name);
  END LOOP;
END;
$$ LANGUAGE plpgsql;
SELECT create_audit_triggers();

-- RLS POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE livestock ENABLE ROW LEVEL SECURITY;
ALTER TABLE livestock_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE livestock_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow profile self read" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admin full access" ON profiles FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Wallet self access" ON wallets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Wallet admin access" ON wallets FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Tx self read" ON transactions FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Tx self insert" ON transactions FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Livestock read active/farmer" ON livestock FOR SELECT USING (
  status != 'draft' OR (farmer_id = auth.uid() AND status = 'draft') OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Updates read all write farmer" ON livestock_updates FOR SELECT USING (true);
CREATE POLICY "Updates insert farmer" ON livestock_updates FOR INSERT WITH CHECK (farmer_id = auth.uid());

CREATE POLICY "Audit logs read only admin" ON audit_logs FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE OR REPLACE FUNCTION set_rls_context()
RETURNS trigger AS $$
BEGIN
  PERFORM set_config('app.current_user_id', NEW.user_id::text, true);
  PERFORM set_config('app.request_ip', '0.0.0.0', true); -- Supabase populates via edge function or middleware
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create initial admin trigger for context