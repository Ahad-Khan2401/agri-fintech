import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'

export default function MfaChallenge() {
  const navigate = useNavigate()
  const { profile, mfaFactorId, refreshMfaState } = useAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fallbackPath = useMemo(() => {
    if (profile?.role === 'admin') return '/admin'
    if (profile?.role === 'farmer') return profile.status === 'approved' ? '/farmer' : '/farmer/kyc'
    return '/investor'
  }, [profile])

  const handleVerify = async () => {
    if (!mfaFactorId) {
      setError('2FA factor not found. Please re-setup from profile settings.')
      return
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter a valid 6-digit authenticator code.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId
      })
      if (challengeError || !challengeData) throw challengeError || new Error('MFA challenge failed')

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: code.trim()
      })
      if (verifyError) throw verifyError

      await refreshMfaState()
      navigate(fallbackPath, { replace: true })
    } catch (err: any) {
      setError(err.message || 'Authenticator verification failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="premium-hero min-h-screen flex items-center justify-center p-4">
      <Card className="premium-shell w-full max-w-md border border-white/20 bg-white/96">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle>Authenticator Verification</CardTitle>
          <CardDescription>Enter the 6-digit code from Google Authenticator to continue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleVerify} disabled={loading}>
            {loading ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</span> : 'Verify & Continue'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
