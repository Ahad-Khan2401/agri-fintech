-- =========================================================
-- 🧠 AI & ADVANCED FEATURES SCHEMA
-- =========================================================

-- AI PREDICTION LOGS (for auditing & model improvement)
CREATE TABLE public.ai_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_id UUID REFERENCES public.livestock(id) ON DELETE CASCADE,
  prediction_type TEXT CHECK (prediction_type IN ('health_risk', 'pricing', 'fraud', 'shariah')),
  input_data JSONB NOT NULL,
  output_data JSONB NOT NULL,
  model_version TEXT DEFAULT 'deepseek-chat-v1',
  confidence_score NUMERIC(3,2),
  human_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DYNAMIC PRICING HISTORY
CREATE TABLE public.pricing_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_id UUID REFERENCES public.livestock(id) ON DELETE CASCADE,
  suggested_price NUMERIC(12,2),
  market_factors JSONB, -- { "eid_demand": 1.3, "feed_cost_change": -0.05 }
  applied BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FRAUD FLAGS (enhanced)
ALTER TABLE public.fraud_flags ADD COLUMN IF NOT EXISTS ai_score NUMERIC(3,2);
ALTER TABLE public.fraud_flags ADD COLUMN IF NOT EXISTS ai_explanation TEXT;
ALTER TABLE public.fraud_flags ADD COLUMN IF NOT EXISTS auto_action TEXT CHECK (auto_action IN ('none', 'flagged', 'blocked'));

-- SHARIAH COMPLIANCE RECORDS
CREATE TABLE public.shariah_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_id UUID REFERENCES public.livestock(id) ON DELETE CASCADE,
  is_compliant BOOLEAN,
  compliance_score NUMERIC(3,2),
  scholarly_references TEXT[],
  conditions TEXT[],
  warnings TEXT[],
  summary_ur TEXT,
  summary_en TEXT,
  fatwa_document_url TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID REFERENCES public.profiles(id) -- Scholar ID
);

-- MULTI-LANGUAGE CONTENT
CREATE TABLE public.translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'livestock', 'update', 'notification'
  entity_id UUID NOT NULL,
  language CHAR(2) NOT NULL CHECK (language IN ('ur', 'en', 'pa', 'sd', 'ps')),
  content JSONB NOT NULL, -- { "title": "...", "description": "..." }
  is_auto_translated BOOLEAN DEFAULT FALSE,
  human_reviewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id, language)
);

-- DISASTER RELIEF FUND
CREATE TABLE public.relief_fund (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_pool NUMERIC(14,2) DEFAULT 0.00,
  allocated NUMERIC(14,2) DEFAULT 0.00,
  last_distribution TIMESTAMPTZ,
  governance_rules JSONB DEFAULT '{
    "auto_deduct_percent": 0.005,
    "max_claim_per_event": 500000,
    "voting_threshold": 0.6
  }'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RELIEF CLAIMS
CREATE TABLE public.relief_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_id UUID REFERENCES public.livestock(id),
  farmer_id UUID REFERENCES public.profiles(id),
  event_type TEXT CHECK (event_type IN ('flood', 'disease', 'theft', 'drought', 'other')),
  claimed_amount NUMERIC(12,2) NOT NULL,
  evidence_urls TEXT[],
  status public.status DEFAULT 'pending',
  approved_amount NUMERIC(12,2),
  distributed_at TIMESTAMPTZ,
  voter_approvals JSONB DEFAULT '[]'::jsonb, -- [{ investor_id, voted_yes }]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- IOT DEVICE REGISTRY (for future hardware integration)
CREATE TABLE public.iot_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_id UUID REFERENCES public.livestock(id) ON DELETE CASCADE,
  device_id TEXT UNIQUE NOT NULL,
  device_type TEXT CHECK (device_type IN ('gps_collar', 'health_sensor', 'weight_scale')),
  last_seen TIMESTAMPTZ,
  battery_level NUMERIC(3,2),
  firmware_version TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- IOT TELEMETRY (time-series ready)
CREATE TABLE public.iot_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.iot_devices(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  location POINT, -- PostGIS extension recommended for production
  temperature_c NUMERIC(4,2),
  heart_rate_bpm INT,
  activity_level TEXT,
  battery_level NUMERIC(3,2),
  raw_data JSONB
);
CREATE INDEX idx_telemetry_time ON public.iot_telemetry(device_id, timestamp DESC);

-- BLOCKCHAIN-STYLE IMMUTABLE LEDGER (for audit transparency)
CREATE TABLE public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_hash TEXT UNIQUE NOT NULL, -- SHA-256 of content + prev_hash
  prev_hash TEXT, -- Links to previous entry for chain integrity
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  content_hash TEXT, -- Hash of the actual data (stored off-chain if large)
  content_preview JSONB, -- Non-sensitive preview for UI
  signature TEXT, -- Digital signature for non-repudiation
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ledger_entity ON public.ledger_entries(entity_type, entity_id);

-- =========================================================
-- 🔄 TRIGGERS FOR AUTOMATION
-- =========================================================

-- Auto-generate Shariah report when livestock goes active
CREATE OR REPLACE FUNCTION public.auto_generate_shariah_report()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status != 'active' THEN
    -- Trigger Edge Function via webhook or queue in production
    -- For now, insert placeholder that admin can review
    INSERT INTO public.shariah_reports (livestock_id, is_compliant, compliance_score, summary_en, summary_ur)
    VALUES (
      NEW.id, 
      NULL, -- Pending AI + scholar review
      NULL,
      'Shariah compliance assessment in progress...',
      'شرعی مطابقت کا جائزہ جاری ہے...'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_shariah ON public.livestock;
CREATE TRIGGER trg_auto_shariah
  AFTER UPDATE ON public.livestock
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_shariah_report();

-- Auto-deduct to relief fund on profit distribution
CREATE OR REPLACE FUNCTION public.auto_relief_deduction()
RETURNS TRIGGER AS $$
DECLARE
  v_deduct_percent NUMERIC := 0.005; -- 0.5%
  v_deduct_amount NUMERIC;
BEGIN
  IF TG_TABLE_NAME = 'profit_distributions' THEN
    v_deduct_amount := NEW.amount * v_deduct_percent;
    
    -- Update relief fund pool
    UPDATE public.relief_fund 
    SET total_pool = total_pool + v_deduct_amount,
        updated_at = NOW()
    WHERE id = (SELECT id FROM public.relief_fund LIMIT 1);
    
    -- Log the deduction
    INSERT INTO public.transactions (user_id, type, amount, reference_id, metadata)
    VALUES (
      NULL, -- System account
      'platform_fee',
      v_deduct_amount,
      NEW.id,
      jsonb_build_object('source', 'profit_distribution', 'percent', v_deduct_percent)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 📊 VIEWS FOR ANALYTICS
-- =========================================================

-- Investor Portfolio Health View
CREATE OR REPLACE VIEW public.investor_portfolio_health AS
SELECT 
  i.investor_id,
  COUNT(DISTINCT i.livestock_id) as total_animals,
  SUM(i.amount) as total_invested,
  AVG(NULLIF(ai.output_data->>'risk_score', '')::numeric) as avg_risk_score,
  COUNT(CASE WHEN ai.output_data->>'risk_level' = 'high' THEN 1 END) as high_risk_count,
  SUM(CASE WHEN l.status = 'sold' THEN pd.amount ELSE 0 END) as realized_profit
FROM public.investments i
JOIN public.livestock l ON i.livestock_id = l.id
LEFT JOIN public.ai_predictions ai ON l.id = ai.livestock_id AND ai.prediction_type = 'health_risk'
LEFT JOIN public.profit_distributions pd ON i.investor_id = pd.investor_id
GROUP BY i.investor_id;

-- Farmer Performance Score
CREATE OR REPLACE VIEW public.farmer_performance_score AS
SELECT 
  p.id as farmer_id,
  COUNT(l.id) as total_listings,
  COUNT(CASE WHEN l.status = 'sold' THEN 1 END) as successful_sales,
  AVG(CASE WHEN l.status = 'sold' THEN (l.cost_price / NULLIF(l.shares_available, 0)) END) as avg_roi_delivered,
  COUNT(vr.id) FILTER (WHERE vr.health_status IS NOT NULL) as health_reports_count,
  COUNT(ff.id) FILTER (WHERE ff.status = 'pending') as pending_fraud_flags,
  -- Composite score (0-100)
  (
    (COUNT(CASE WHEN l.status = 'sold' THEN 1 END) * 30) +
    (COALESCE(AVG(CASE WHEN l.status = 'sold' THEN 100 * (1 - (l.cost_price / NULLIF(l.shares_available * l.price_per_share, 0))) END), 0) * 0.4) +
    (100 - COUNT(ff.id) * 10) -- Deduct for fraud flags
  ) as performance_score
FROM public.profiles p
LEFT JOIN public.livestock l ON p.id = l.farmer_id
LEFT JOIN public.vet_reports vr ON l.id = vr.livestock_id
LEFT JOIN public.fraud_flags ff ON l.id = ff.livestock_id
WHERE p.role = 'farmer'
GROUP BY p.id;

-- =========================================================
-- 🛡️ RLS POLICIES FOR NEW TABLES
-- =========================================================

ALTER TABLE public.ai_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shariah_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relief_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- AI Predictions: Investors see predictions for their investments; Farmers see for their livestock
CREATE POLICY "View AI predictions for owned livestock" ON public.ai_predictions 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.livestock WHERE id = livestock_id AND farmer_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.investments WHERE livestock_id = ai_predictions.livestock_id AND investor_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Shariah Reports: Public view for transparency
CREATE POLICY "Shariah reports are public" ON public.shariah_reports FOR SELECT USING (true);

-- Relief Claims: Only involved parties + admins
CREATE POLICY "View relief claims for involved parties" ON public.relief_claims 
  FOR SELECT USING (
    farmer_id = auth.uid() 
    OR 
    EXISTS (SELECT 1 FROM public.investments i JOIN public.livestock l ON i.livestock_id = l.id WHERE l.id = relief_claims.livestock_id AND i.investor_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Ledger: Read-only for transparency, write via functions only
CREATE POLICY "Ledger is read-only public" ON public.ledger_entries FOR SELECT USING (true);
CREATE POLICY "Ledger inserts via functions only" ON public.ledger_entries FOR INSERT WITH CHECK (false);
