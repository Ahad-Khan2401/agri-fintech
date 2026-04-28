-- Contract fixes for frontend/API compatibility and money-flow RPCs.

ALTER TABLE public.kyc_documents
  ADD COLUMN IF NOT EXISTS document_type varchar(30),
  ADD COLUMN IF NOT EXISTS admin_notes text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kyc_documents'
      AND column_name = 'type'
  ) THEN
    UPDATE public.kyc_documents
    SET document_type = COALESCE(document_type, type)
    WHERE document_type IS NULL;

    UPDATE public.kyc_documents
    SET type = COALESCE(type, document_type)
    WHERE type IS NULL;
  END IF;
END $$;

ALTER TABLE public.livestock
  ADD COLUMN IF NOT EXISTS location_city text,
  ADD COLUMN IF NOT EXISTS area text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'livestock'
      AND column_name = 'location'
  ) THEN
    UPDATE public.livestock
    SET
      location_city = COALESCE(location_city, location ->> 'city'),
      area = COALESCE(area, location ->> 'area')
    WHERE location IS NOT NULL;
  END IF;
END $$;

ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "KYC self access" ON public.kyc_documents;
CREATE POLICY "KYC self access" ON public.kyc_documents
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "KYC admin access" ON public.kyc_documents;
CREATE POLICY "KYC admin access" ON public.kyc_documents
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE OR REPLACE FUNCTION public.sync_kyc_document_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.document_type := COALESCE(NEW.document_type, NEW.type);
  NEW.type := COALESCE(NEW.type, NEW.document_type);
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kyc_documents'
      AND column_name = 'type'
  ) THEN
    DROP TRIGGER IF EXISTS trg_sync_kyc_document_type ON public.kyc_documents;
    CREATE TRIGGER trg_sync_kyc_document_type
      BEFORE INSERT OR UPDATE ON public.kyc_documents
      FOR EACH ROW EXECUTE FUNCTION public.sync_kyc_document_type();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.invest_atomic(
  p_livestock_id uuid,
  p_investor_id uuid,
  p_shares integer,
  p_wallet_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_livestock public.livestock%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_investment_id uuid;
  v_amount numeric(12,2);
  v_ownership numeric(5,2);
  v_new_available integer;
BEGIN
  IF p_shares IS NULL OR p_shares <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid shares');
  END IF;

  IF p_wallet_id <> p_investor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet does not match investor');
  END IF;

  SELECT * INTO v_livestock
  FROM public.livestock
  WHERE id = p_livestock_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Livestock not found');
  END IF;

  IF v_livestock.status NOT IN ('active', 'funded') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project is not open for investment');
  END IF;

  IF COALESCE(v_livestock.shares_available, 0) < p_shares THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough shares available');
  END IF;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_wallet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  v_amount := ROUND((p_shares * v_livestock.price_per_share)::numeric, 2);
  v_ownership := ROUND(((p_shares::numeric / v_livestock.total_shares::numeric) * 100)::numeric, 2);

  IF v_wallet.main_balance < v_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.wallets
  SET
    main_balance = main_balance - v_amount,
    escrow_locked = escrow_locked + v_amount,
    updated_at = now()
  WHERE user_id = p_wallet_id;

  INSERT INTO public.investments (livestock_id, investor_id, shares, amount, ownership_percent)
  VALUES (p_livestock_id, p_investor_id, p_shares, v_amount, v_ownership)
  RETURNING id INTO v_investment_id;

  v_new_available := v_livestock.shares_available - p_shares;

  UPDATE public.livestock
  SET
    shares_available = v_new_available,
    status = CASE WHEN v_new_available = 0 THEN 'funded'::public.status ELSE status END,
    updated_at = now()
  WHERE id = p_livestock_id;

  INSERT INTO public.transactions (user_id, type, amount, reference_id, metadata, status)
  VALUES (
    p_investor_id,
    'investment',
    v_amount,
    v_investment_id,
    jsonb_build_object('livestock_id', p_livestock_id, 'shares', p_shares),
    'completed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'investment_id', v_investment_id,
      'amount', v_amount,
      'shares_available', v_new_available
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.distribute_profit(
  p_sale_id uuid,
  p_net_profit numeric,
  p_platform_fee numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.sale_requests%ROWTYPE;
  v_livestock public.livestock%ROWTYPE;
  v_investor record;
  v_profit_share numeric(12,2);
  v_principal numeric(12,2);
  v_payout numeric(12,2);
  v_farmer_profit numeric(12,2);
BEGIN
  SELECT * INTO v_sale FROM public.sale_requests WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sale request not found');
  END IF;

  SELECT * INTO v_livestock FROM public.livestock WHERE id = v_sale.livestock_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Livestock not found');
  END IF;

  FOR v_investor IN
    SELECT investor_id, SUM(shares)::numeric AS shares, SUM(amount)::numeric AS amount
    FROM public.investments
    WHERE livestock_id = v_livestock.id
    GROUP BY investor_id
  LOOP
    v_principal := ROUND(v_investor.amount, 2);
    v_profit_share := ROUND((p_net_profit * (v_investor.shares / v_livestock.total_shares))::numeric, 2);
    v_payout := v_principal + v_profit_share;

    UPDATE public.wallets
    SET
      main_balance = main_balance + v_payout,
      escrow_locked = GREATEST(0, escrow_locked - v_principal),
      updated_at = now()
    WHERE user_id = v_investor.investor_id;

    INSERT INTO public.transactions (user_id, type, amount, reference_id, metadata, status)
    VALUES (
      v_investor.investor_id,
      'profit_share',
      v_payout,
      p_sale_id,
      jsonb_build_object('principal', v_principal, 'profit', v_profit_share, 'platform_fee_total', p_platform_fee),
      'completed'
    );

    INSERT INTO public.profit_distributions (sale_id, investor_id, farmer_id, amount, platform_fee)
    VALUES (p_sale_id, v_investor.investor_id, v_livestock.farmer_id, v_profit_share, p_platform_fee);
  END LOOP;

  v_farmer_profit := ROUND((p_net_profit * (v_livestock.farmer_shares::numeric / v_livestock.total_shares::numeric))::numeric, 2);
  IF v_farmer_profit > 0 THEN
    UPDATE public.wallets
    SET main_balance = main_balance + v_farmer_profit, updated_at = now()
    WHERE user_id = v_livestock.farmer_id;

    INSERT INTO public.transactions (user_id, type, amount, reference_id, metadata, status)
    VALUES (
      v_livestock.farmer_id,
      'profit_share',
      v_farmer_profit,
      p_sale_id,
      jsonb_build_object('source', 'farmer_retained_shares'),
      'completed'
    );

    INSERT INTO public.profit_distributions (sale_id, farmer_id, amount, platform_fee)
    VALUES (p_sale_id, v_livestock.farmer_id, v_farmer_profit, 0);
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.distribute_loss(
  p_sale_id uuid,
  p_profit numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.sale_requests%ROWTYPE;
  v_livestock public.livestock%ROWTYPE;
  v_investor record;
  v_loss_abs numeric(12,2);
  v_principal numeric(12,2);
  v_loss_share numeric(12,2);
  v_refund numeric(12,2);
BEGIN
  SELECT * INTO v_sale FROM public.sale_requests WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sale request not found');
  END IF;

  SELECT * INTO v_livestock FROM public.livestock WHERE id = v_sale.livestock_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Livestock not found');
  END IF;

  v_loss_abs := ABS(COALESCE(p_profit, 0));

  FOR v_investor IN
    SELECT investor_id, SUM(shares)::numeric AS shares, SUM(amount)::numeric AS amount
    FROM public.investments
    WHERE livestock_id = v_livestock.id
    GROUP BY investor_id
  LOOP
    v_principal := ROUND(v_investor.amount, 2);
    v_loss_share := ROUND((v_loss_abs * (v_investor.shares / v_livestock.total_shares))::numeric, 2);
    v_refund := GREATEST(0, v_principal - v_loss_share);

    UPDATE public.wallets
    SET
      main_balance = main_balance + v_refund,
      escrow_locked = GREATEST(0, escrow_locked - v_principal),
      updated_at = now()
    WHERE user_id = v_investor.investor_id;

    INSERT INTO public.transactions (user_id, type, amount, reference_id, metadata, status)
    VALUES (
      v_investor.investor_id,
      'refund',
      v_refund,
      p_sale_id,
      jsonb_build_object('principal', v_principal, 'loss_share', v_loss_share),
      'completed'
    );

    INSERT INTO public.profit_distributions (sale_id, investor_id, farmer_id, amount, platform_fee)
    VALUES (p_sale_id, v_investor.investor_id, v_livestock.farmer_id, -v_loss_share, 0);
  END LOOP;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload schema';
