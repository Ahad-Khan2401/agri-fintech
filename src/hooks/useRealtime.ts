import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useRealtimeLivestock(onChange: (livestock: any) => void) {
  useEffect(() => {
    const channel = supabase
      .channel('livestock-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'livestock' },
        (payload) => onChange(payload.new)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [onChange])
}

export function useRealtimeInvestments(userId: string | undefined, onChange: (investment: any) => void) {
  useEffect(() => {
    if (!userId) return
    
    const channel = supabase
      .channel(`investments-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'investments', filter: `investor_id=eq.${userId}` },
        (payload) => onChange(payload.new)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, onChange])
}