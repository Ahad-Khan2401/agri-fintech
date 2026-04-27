import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../../store/auth'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/Card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../components/ui/Form'
import { AlertCircle, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const { login, loginWithGoogle, profile, isLoading } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [oauthProcessing, setOauthProcessing] = useState(false)

  const hasOAuthParams = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.location.hash.includes('access_token') || window.location.search.includes('code=')
  }, [])

  const form = useForm<LoginFormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' }
  })

  const redirectByRole = () => {
    const { profile: latestProfile } = useAuth.getState()
    if (!latestProfile) return
    if (latestProfile.role === 'admin') {
      navigate('/admin', { replace: true })
    } else if (latestProfile.role === 'farmer') {
      navigate(latestProfile.status === 'approved' ? '/farmer' : '/farmer/kyc', { replace: true })
    } else if (latestProfile.role === 'investor') {
      navigate('/investor', { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }

  useEffect(() => {
    if (!isLoading && profile) redirectByRole()
  }, [isLoading, profile])

  useEffect(() => {
    if (!hasOAuthParams) return
    let cancelled = false

    const finishOAuth = async () => {
      setOauthProcessing(true)
      setServerError(null)

      for (let attempt = 0; attempt < 8; attempt += 1) {
        await useAuth.getState().load()
        const { profile: latestProfile, error } = useAuth.getState()

        if (latestProfile) {
          if (!cancelled) redirectByRole()
          return
        }

        if (error && attempt >= 3) {
          if (!cancelled) setServerError(`Google login connected, but profile setup failed: ${error}`)
          break
        }

        await new Promise((resolve) => setTimeout(resolve, 350))
      }

      if (!cancelled) setOauthProcessing(false)
    }

    finishOAuth()
    return () => {
      cancelled = true
    }
  }, [hasOAuthParams])

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null)
    const result = await login(data.email, data.password)
    
    if (result.success) {
      // Wait for profile to be loaded
      setTimeout(() => {
        redirectByRole()
      }, 100)
    } else {
      setServerError(result.error || 'Login failed')
    }
  }

  const handleGoogleLogin = async () => {
    setServerError(null)
    const result = await loginWithGoogle()
    if (!result.success) setServerError(result.error || 'Google login failed')
  }

  return (
    <div className="premium-hero min-h-screen flex items-center justify-center p-4">
      <Card className="premium-shell w-full max-w-md border border-white/20 bg-white/96">
        {oauthProcessing && (
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <ShieldCheck className="h-7 w-7 text-emerald-700" />
            </div>
            <h2 className="text-xl font-bold text-stone-900">Setting up your account</h2>
            <p className="mt-2 text-sm text-stone-600">Google verified. We are preparing your dashboard...</p>
            <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-emerald-700" />
          </CardContent>
        )}
        {!oauthProcessing && (
        <>
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">M</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-stone-900">Welcome Back</CardTitle>
          <CardDescription className="text-stone-600">Secure access for farmers, investors and admins</CardDescription>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
            <CardContent className="space-y-4 pt-4">
              {serverError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{serverError}</span>
                </div>
              )}

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl><Input type="email" placeholder="you@example.com" {...field} autoComplete="email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...field} autoComplete="current-password" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <div className="flex justify-end"><Link to="/forgot-password" className="text-xs text-green-600 hover:underline">Forgot password?</Link></div>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                <strong>Security:</strong> Admin access is protected with role-based permissions and audit monitoring.
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 pt-2">
              <Button type="submit" className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-medium" disabled={isLoading}>
                {isLoading ? <span className="flex items-center gap-2"><Loader2 className="animate-spin h-4 w-4" /> Signing in...</span> : 'Sign In'}
              </Button>
              <div className="flex w-full items-center gap-3 text-xs text-stone-400">
                <span className="h-px flex-1 bg-stone-200" />
                OR
                <span className="h-px flex-1 bg-stone-200" />
              </div>
              <Button type="button" variant="outline" onClick={handleGoogleLogin} className="w-full h-11 border-stone-200 bg-white font-medium text-stone-800 hover:bg-stone-50" disabled={isLoading}>
                <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm font-bold text-blue-600 shadow-sm">G</span>
                Continue with Google
              </Button>
              <p className="text-sm text-center text-stone-600">
                Don't have an account?{' '}
                <Link to="/signup" className="text-green-600 font-medium hover:underline">Create free account</Link>
              </p>
            </CardFooter>
          </form>
        </Form>
        </>
        )}
      </Card>
    </div>
  )
}
