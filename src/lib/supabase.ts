import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: { 'x-application-name': 'agri-fintech' }
  }
})

export type Database = {
  public: {
    Tables: {
      profiles: { Row: { id: string; role: 'investor'|'farmer'|'admin'; phone: string|null; phone_verified: boolean; status: string; created_at: string; updated_at: string } }
      wallets: { Row: { user_id: string; main_balance: number; escrow_locked: number; currency: string; updated_at: string } }
      livestock: { Row: { id: string; farmer_id: string; title: string; breed: string|null; age_months: number; weight_kg: number; location: any; cost_price: number; total_shares: number; price_per_share: number; farmer_shares: number; shares_available: number; status: string; insurance_enabled: boolean; created_at: string } }
      investments: { Row: { id: string; livestock_id: string; investor_id: string; shares: number; amount: number; ownership_percent: number; created_at: string } }
      livestock_updates: { Row: { id: string; livestock_id: string; farmer_id: string; weight_kg: number|null; health_status: string|null; notes: string|null; media_url: string|null; created_at: string } }
      sale_requests: { Row: { id: string; livestock_id: string; farmer_id: string; proposed_price: number; buyer_phone: string|null; market_location: any; receipt_url: string|null; sale_video_url: string|null; status: string; admin_verified_at: string|null; created_at: string } }
      kyc_documents: { Row: { id: string; user_id: string; type: string; file_url: string; status: string; verified_by: string|null; notes: string|null; created_at: string } }
    }
  }
}