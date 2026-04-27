import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const callAI = useCallback(async (action: string, payload: any) => {
    setLoading(true)
    setError(null)
    try {
      const { data: response, error: invokeError } = await supabase.functions.invoke('ai-service', {
        body: { action, payload }
      })
      if (invokeError) throw invokeError
      if (!response?.success) throw new Error(response?.error || 'AI request failed')

      const normalizedData = response?.data ?? (response?.reply ? { reply: response.reply } : {})

      // Log prediction to ai_predictions table
      if (payload.livestock_id) {
        await supabase.from('ai_predictions').insert([{
          livestock_id: payload.livestock_id,
          prediction_type: action.replace('suggest_', '').replace('detect_', '').replace('generate_', ''),
          input_data: payload,
          output_data: normalizedData,
          confidence_score: normalizedData.confidence || normalizedData.compliance_score || null
        }])
      }
      return { success: true, data: normalizedData }
    } catch (err: any) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    predictHealth: (livestock: any) => callAI('predict_health_risk', livestock),
    suggestPricing: (livestock: any) => callAI('suggest_pricing', livestock),
    detectFraud: (livestock: any) => callAI('detect_fraud', livestock),
    generateShariahReport: (livestock: any) => callAI('generate_shariah_report', livestock),
    chat: (message: string, language?: string, context?: any) => callAI('chat_assistant', { message, language, context }),
  }
}
