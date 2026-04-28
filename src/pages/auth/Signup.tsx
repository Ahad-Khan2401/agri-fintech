import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../../store/auth'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/Card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../components/ui/Form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select'
import { getDashboardPath } from '../../lib/auth-routing'
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

const schema = z.object({
  full_name: z.string().min(2, 'Full name required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^03\d{9}$/, 'Enter valid PK phone (03XXXXXXXXX)'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['investor', 'farmer'], { required_error: 'Choose account type first' }),
  agree_terms: z.boolean().refine(val => val === true, 'You must agree to Terms & Conditions'),
})

type SignupFormData = z.infer<typeof schema>

export default function Signup() {
  const navigate = useNavigate()
  const { signup, loginWithGoogle, isLoading, profile } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const form = useForm<SignupFormData>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: '', email: '', phone: '', password: '', role: undefined as any, agree_terms: false }
  })

  const onSubmit = async (data: SignupFormData) => {
    setSubmitting(true)
    setServerError(null)
    setSuccessMsg(null)

    try {
      const result = await signup(data.email, data.password, data.role, data.phone, data.full_name)
      if (result.success) {
        setSuccessMsg('Account created! Redirecting...')
        setTimeout(() => {
          const latestProfile = useAuth.getState().profile || profile
          navigate(getDashboardPath(latestProfile || ({ role: data.role, status: data.role === 'farmer' ? 'pending' : 'active' } as any)), { replace: true })
        }, 1500)
      } else {
        setServerError(result.error || 'Signup failed')
      }
    } catch (err: any) {
      setServerError(err.message || 'Failed to create account')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleSignup = async () => {
    setServerError(null)
    setSuccessMsg(null)
    const role = form.getValues('role')
    if (!role) {
      setServerError('Please choose Investor or Farmer before continuing with Google.')
      form.setError('role', { message: 'Choose account type first' })
      return
    }
    setSubmitting(true)
    const result = await loginWithGoogle(role)
    if (!result.success) setServerError(result.error || 'Google signup failed')
    setSubmitting(false)
  }

  return (
    <div className="premium-hero min-h-screen flex items-center justify-center p-4">
      <Card className="premium-shell w-full max-w-md border border-white/20 bg-white/96">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">M</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-stone-900">Create Account</CardTitle>
          <CardDescription className="text-stone-600">Create your secure account for farmer-financing platform</CardDescription>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
            <CardContent className="space-y-4 pt-4">
              {serverError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{serverError}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex gap-2 text-sm text-green-700">
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{successMsg}</span>
                </div>
              )}

              <FormField control={form.control} name="full_name" render={({ field }) => (
                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Ahmed Raza" {...field} autoComplete="name" /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Choose account type first</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="bg-white"><SelectValue placeholder="Select your role" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="investor">📈 Invest in livestock & earn profit</SelectItem>
                      <SelectItem value="farmer">🌾 List my animals & raise funds</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="you@example.com" {...field} autoComplete="email" /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone Number (Pakistan)</FormLabel><FormControl><Input placeholder="03001234567" {...field} autoComplete="tel" /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} autoComplete="new-password" /></FormControl><FormMessage /></FormItem>
              )} />

              {form.watch('role') === 'farmer' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                  <strong>Note:</strong> Farmers require KYC verification (CNIC, selfie, bank details) before listing livestock.
                </div>
              )}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                <strong>Security Policy:</strong> Admin module uses role-based access, audit logs and manual approval controls.
              </div>

              <FormField control={form.control} name="agree_terms" render={({ field }) => (
                <FormItem className="flex items-start gap-3 space-y-0">
                  <FormControl><Input type="checkbox" checked={field.value} onChange={field.onChange} className="w-4 h-4 mt-1 accent-green-600" /></FormControl>
                  <div className="text-sm text-stone-600">I agree to the <Link to="/terms" className="text-green-600 hover:underline">Terms & Conditions</Link> and <Link to="/risk" className="text-green-600 hover:underline">Risk Disclosure</Link>.</div>
                  <FormMessage className="w-full" />
                </FormItem>
              )} />
            </CardContent>

            <CardFooter className="flex flex-col gap-4 pt-2">
              <Button type="submit" className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-medium" disabled={submitting || isLoading}>
                {submitting ? 'Creating account...' : 'Create Free Account'}
              </Button>
              <div className="flex w-full items-center gap-3 text-xs text-stone-400">
                <span className="h-px flex-1 bg-stone-200" />
                OR
                <span className="h-px flex-1 bg-stone-200" />
              </div>
              <Button type="button" variant="outline" onClick={handleGoogleSignup} className="w-full h-11 border-stone-200 bg-white font-medium text-stone-800 hover:bg-stone-50" disabled={submitting || isLoading}>
                <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm font-bold text-blue-600 shadow-sm">G</span>
                {submitting ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Opening Google...</span> : (form.watch('role') ? `Continue with Google as ${form.watch('role') === 'farmer' ? 'Farmer' : 'Investor'}` : 'Choose type for Google')}
              </Button>
              <p className="text-xs text-center text-stone-500">
                Google signup only needs account type. Profile/KYC details can be completed after login.
              </p>
              <p className="text-sm text-center text-stone-600">
                Already have an account?{' '}
                <Link to="/login" className="text-green-600 font-medium hover:underline">Sign in here</Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
