import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { CheckCircle, Loader2, ShieldCheck, Stethoscope } from 'lucide-react'
import PakistanLocationSelect from '../../components/location/PakistanLocationSelect'

const initialForm = {
  full_name: '',
  phone: '',
  city: 'Karachi',
  area: '',
  clinic_name: '',
  license_no: '',
  experience_years: '',
  qualification: '',
  document_url: '',
}

export default function DoctorOnboarding() {
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const updateField = (key: keyof typeof initialForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const submit = async () => {
    setMessage(null)
    setError(null)
    if (!form.full_name || !form.phone || !form.city || !form.area || !form.license_no) {
      setError('Name, phone, city, area and license number are required.')
      return
    }

    setSaving(true)
    try {
      const extendedPayload = {
        full_name: form.full_name,
        phone: form.phone,
        city: form.city,
        area: form.area,
        clinic_name: form.clinic_name || null,
        license_no: form.license_no,
        experience_years: Number(form.experience_years || 0) || null,
        qualification: form.qualification || null,
        document_url: form.document_url || null,
        fee_per_animal: 0,
        status: 'pending',
      }

      const firstAttempt = await supabase.from('veterinary_partners').insert(extendedPayload)

      if (firstAttempt.error?.message?.includes('column')) {
        const { area, experience_years, qualification, document_url, ...basePayload } = extendedPayload
        const fallback = await supabase.from('veterinary_partners').insert(basePayload)
        if (fallback.error) throw fallback.error
      } else if (firstAttempt.error) {
        throw firstAttempt.error
      }

      setForm(initialForm)
      setMessage('Application submitted. Admin will verify your license before you receive tasks.')
    } catch (err: any) {
      setError(err.message || 'Unable to submit doctor application.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_5%,rgba(212,174,92,0.18),transparent_28%),linear-gradient(135deg,#fbf8ef_0%,#ecf3ef_100%)]">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-lg bg-[#14261f] p-8 text-white shadow-[0_32px_90px_-42px_rgba(20,38,31,0.9)]">
          <Badge className="mb-4 bg-amber-300/15 text-amber-100 border border-amber-200/20">Doctor Partner Network</Badge>
          <h1 className="font-serif text-4xl font-bold">Join MaweshiHub as a livestock medical partner</h1>
          <p className="mt-3 max-w-2xl text-sm text-emerald-50/75">Verified doctors receive nearby livestock inspection requests. First qualified doctor to accept gets the assignment.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
          <Card className="premium-shell border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-emerald-700" /> Doctor Details</CardTitle>
              <CardDescription>Complete details help admin verify you quickly.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Full name" value={form.full_name} onChange={(e) => updateField('full_name', e.target.value)} />
              <Input placeholder="Phone number" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
              <div className="sm:col-span-2">
                <PakistanLocationSelect
                  city={form.city}
                  area={form.area}
                  onCityChange={(value) => updateField('city', value)}
                  onAreaChange={(value) => updateField('area', value)}
                  cityLabel="Practice city/village"
                  areaLabel="Practice area"
                />
              </div>
              <Input placeholder="Clinic name" value={form.clinic_name} onChange={(e) => updateField('clinic_name', e.target.value)} />
              <Input placeholder="License number" value={form.license_no} onChange={(e) => updateField('license_no', e.target.value)} />
              <Input placeholder="Experience years" type="number" value={form.experience_years} onChange={(e) => updateField('experience_years', e.target.value)} />
              <Input placeholder="Qualification / degree" value={form.qualification} onChange={(e) => updateField('qualification', e.target.value)} />
              <Input className="sm:col-span-2" placeholder="Degree/license image URL for now" value={form.document_url} onChange={(e) => updateField('document_url', e.target.value)} />

              {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
              {message && <p className="sm:col-span-2 text-sm text-emerald-700">{message}</p>}

              <Button className="sm:col-span-2 bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Doctor Application'}
              </Button>
            </CardContent>
          </Card>

          <Card className="premium-shell border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-700" /> How Tasks Work</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-stone-700">
              <div className="flex gap-3"><CheckCircle className="h-5 w-5 text-emerald-600" /> Farmer lists animal after KYC.</div>
              <div className="flex gap-3"><CheckCircle className="h-5 w-5 text-emerald-600" /> Admin approval creates a city/area medical request.</div>
              <div className="flex gap-3"><CheckCircle className="h-5 w-5 text-emerald-600" /> Nearby verified doctors see the request.</div>
              <div className="flex gap-3"><CheckCircle className="h-5 w-5 text-emerald-600" /> First doctor to accept owns the task.</div>
              <Link to="/doctor/tasks" className="block">
                <Button variant="outline" className="mt-2 w-full">Open Doctor Task Board</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
