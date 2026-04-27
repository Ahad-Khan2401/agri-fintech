import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuth } from './auth'

export interface Transaction {
  id: string
  user_id: string
  type:
    | 'deposit'
    | 'investment'
    | 'escrow_hold'
    | 'maintenance_release'
    | 'profit_share'
    | 'platform_fee'
    | 'insurance_payout'
    | 'refund'
    | 'withdrawal'
    | 'farmer_payout'
  amount: number
  reference_id: string | null
  metadata: any | null
  status: 'pending' | 'completed' | 'failed'
  created_at: string
}

export interface WalletState {
  balance: number
  escrowLocked: number
  transactions: Transaction[]
  withdrawalRequests: any[]
  isLoading: boolean
  loadWallet: () => Promise<void>
  deposit: (amount: number) => Promise<{ success: boolean; error?: string }>
  requestWithdrawal: (amount: number, accountTitle: string, iban: string) => Promise<{ success: boolean; error?: string }>
  invest: (livestockId: string, shares: number) => Promise<{ success: boolean; error?: string }>
}

export const useWallet = create<WalletState>((set, get) => ({
  balance: 0,
  escrowLocked: 0,
  transactions: [],
  withdrawalRequests: [],
  isLoading: true,

  loadWallet: async () => {
    const { profile } = useAuth.getState()
    if (!profile) return
    
    try {
      set({ isLoading: true })
      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', profile.id)
        .single()
      
      const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50)

      const { data: withdrawalRequests } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (wallet) {
        set({ 
          balance: parseFloat(wallet.main_balance), 
          escrowLocked: parseFloat(wallet.escrow_locked),
          transactions: txs || [],
          withdrawalRequests: withdrawalRequests || []
        })
      }
    } finally {
      set({ isLoading: false })
    }
  },

  deposit: async (amount) => {
    const { profile } = useAuth.getState()
    if (!profile) return { success: false, error: 'Not authenticated' }

    try {
      // In production: integrate payment gateway (JazzCash/EasyPaisa/Stripe)
      // For demo: simulate successful deposit
      
      const { error: walletError } = await supabase
        .from('wallets')
        .update({ 
          main_balance: parseFloat((get().balance + amount).toFixed(2)),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', profile.id)
      
      if (walletError) throw walletError

      const { error: txError } = await supabase.from('transactions').insert([{
        user_id: profile.id,
        type: 'deposit',
        amount,
        status: 'completed',
        metadata: { method: 'demo' }
      }])

      if (txError) throw txError
      
      await get().loadWallet()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  },

  requestWithdrawal: async (amount, accountTitle, iban) => {
    const { profile } = useAuth.getState()
    if (!profile) return { success: false, error: 'Not authenticated' }
    if (amount <= 0) return { success: false, error: 'Invalid amount' }
    if (amount > get().balance) return { success: false, error: 'Insufficient balance' }

    try {
      const { error } = await supabase.from('withdrawal_requests').insert([{
        user_id: profile.id,
        amount,
        account_title: accountTitle,
        iban,
        method: 'bank_transfer',
        status: 'pending'
      }])
      if (error) throw error

      await get().loadWallet()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Withdrawal request failed' }
    }
  },

  invest: async (livestockId, shares) => {
    const { profile } = useAuth.getState()
    if (!profile) return { success: false, error: 'Not authenticated' }

    try {
      // Call Edge Function for atomic transaction
      const { data, error } = await supabase.functions.invoke('invest', {
        body: {
          livestockId,
          investorId: profile.id,
          shares,
          walletId: profile.id
        }
      })

      if (error || !data?.success) {
        throw new Error(data?.error || 'Investment failed')
      }

      await get().loadWallet()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}))
