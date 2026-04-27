import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Alert, AlertTitle, AlertDescription } from '../../components/ui/Alert'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)

  useEffect(() => {
    const hash = window.location.hash || ''
    if (!hash.includes('type=recovery')) return

    setIsRecoveryMode(true)
    const setupRecoveryMfa = async () => {
      const [{ data: aalData }, { data: factorData }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ])

      const factor = factorData?.totp?.find((item) => item.status === 'verified')
      setMfaFactorId(factor?.id ?? null)
      setMfaRequired(Boolean(factor) && aalData?.currentLevel !== 'aal2')
    }

    setupRecoveryMfa().catch(() => {
      setMfaFactorId(null)
      setMfaRequired(false)
    })
  }, [])

  const canSubmitPassword = useMemo(
    () => password.length >= 8 && password === confirmPassword,
    [password, confirmPassword]
  )

  const sendResetLink = async () => {
    if (!email) return
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/forgot-password`,
      })
      if (resetError) throw resetError
      setMessage('Password reset link sent. Check your inbox.')
    } catch (err: any) {
      setError(err.message || 'Unable to send reset email')
    } finally {
      setLoading(false)
    }
  }

  const updatePassword = async () => {
    if (!canSubmitPassword) return
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      if (mfaRequired) {
        if (!mfaFactorId) throw new Error('Authenticator factor is missing. Re-open reset link and try again.')
        if (!/^\d{6}$/.test(mfaCode.trim())) throw new Error('Enter a valid 6-digit Google Authenticator code.')

        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
        if (challengeError || !challengeData) throw challengeError || new Error('MFA challenge failed')

        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId: mfaFactorId,
          challengeId: challengeData.id,
          code: mfaCode.trim(),
        })
        if (verifyError) throw verifyError
        setMfaRequired(false)
      }

      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setMessage('Password updated successfully. You can now sign in.')
      setPassword('')
      setConfirmPassword('')
      setMfaCode('')
    } catch (err: any) {
      if (String(err?.message || '').toLowerCase().includes('aal2')) {
        setMfaRequired(true)
      }
      setError(err.message || 'Unable to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="premium-hero min-h-screen p-4 flex items-center justify-center">
      <Card className="premium-shell w-full max-w-md border border-white/20 bg-white/96">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-green-600 text-white flex items-center justify-center font-bold text-xl">M</div>
          <CardTitle className="text-2xl font-bold text-stone-900">
            {isRecoveryMode ? 'Set New Password' : 'Reset Password'}
          </CardTitle>
          <CardDescription className="text-stone-600">
            {isRecoveryMode ? 'Choose a strong new password for your account.' : 'Enter your email and receive a secure reset link.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Success</AlertTitle>
              <AlertDescription className="text-green-700">{message}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isRecoveryMode ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700">Email address</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button className="w-full bg-green-600 hover:bg-green-700" onClick={sendResetLink} disabled={loading || !email}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Reset Link'}
              </Button>
            </>
          ) : (
            <>
              {mfaRequired && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">Google Authenticator code</label>
                  <Input
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6-digit code"
                  />
                  <p className="text-xs text-stone-500">MFA enabled accounts need authenticator verification before password update.</p>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700">New password</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700">Confirm password</label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
              </div>
              <Button className="w-full bg-green-600 hover:bg-green-700" onClick={updatePassword} disabled={loading || !canSubmitPassword}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
              </Button>
              {!canSubmitPassword && (
                <p className="text-xs text-stone-500">Password must be 8+ chars and both fields must match.</p>
              )}
            </>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          <Link to="/login" className="text-sm text-green-700 hover:underline">Back to Login</Link>
        </CardFooter>
      </Card>
    </div>
  )
}
