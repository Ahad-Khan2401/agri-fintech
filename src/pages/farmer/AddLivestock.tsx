import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { ArrowLeft, CheckCircle, AlertCircle, X, Sparkles, ShieldCheck, Camera, Wand2 } from 'lucide-react'
import PakistanLocationSelect from '../../components/location/PakistanLocationSelect'

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  breed: z.string().min(2, 'Please select a breed'),
  age_months: z.coerce.number().min(1).max(120, 'Age cannot exceed 10 years'),
  weight_kg: z.coerce.number().min(10, 'Minimum weight 10kg'),
  city: z.string().min(2, 'City is required'),
  area: z.string().min(2, 'Area is required'),
  cost_price: z.coerce.number().min(1000, 'Minimum cost PKR 1,000'),
  total_shares: z.coerce.number().int().min(10).max(1000),
  price_per_share: z.coerce.number().min(100, 'Minimum PKR 100 per share'),
  farmer_shares: z.coerce.number().int().min(1),
  insurance_enabled: z.boolean().default(true),
}).refine(d => d.farmer_shares >= Math.ceil(d.total_shares * 0.2), {
  message: 'Farmer must own ≥ 20% shares',
  path: ['farmer_shares']
}).refine(d => d.price_per_share * d.total_shares >= d.cost_price, {
  message: 'Total share value must cover cost price',
  path: ['price_per_share']
})

type FormData = z.infer<typeof schema>

const animalTemplates = [
  {
    key: 'bull',
    label: 'Qurbani / Bull',
    hint: 'Tez sale aur strong demand',
    values: { title: 'Healthy Sahiwal Bull', breed: 'Sahiwal', age_months: 18, weight_kg: 180, cost_price: 140000, total_shares: 140, price_per_share: 1000, farmer_shares: 28 }
  },
  {
    key: 'buffalo',
    label: 'Doodh Wali Buffalo',
    hint: 'Stable cashflow type project',
    values: { title: 'Milk Buffalo Financing', breed: 'Nili-Ravi', age_months: 30, weight_kg: 360, cost_price: 220000, total_shares: 220, price_per_share: 1000, farmer_shares: 44 }
  },
  {
    key: 'goat',
    label: 'Goat / Bakra',
    hint: 'Small ticket, easy funding',
    values: { title: 'Healthy Goat Batch', breed: 'Mixed', age_months: 12, weight_kg: 42, cost_price: 45000, total_shares: 90, price_per_share: 500, farmer_shares: 18 }
  }
]

const financePresets = [
  { key: 'simple', label: 'Simple Plan', desc: '100 shares, farmer 20%', shares: 100, farmerRatio: 0.2 },
  { key: 'strong', label: 'Trust Plan', desc: 'Farmer 30% own kare', shares: 120, farmerRatio: 0.3 },
  { key: 'premium', label: 'Elite Plan', desc: 'Bara project, high ticket', shares: 200, farmerRatio: 0.25 },
]

export default function AddLivestock() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '', breed: '', age_months: 12, weight_kg: 100,
      city: '', area: '', cost_price: 50000, total_shares: 100,
      price_per_share: 500, farmer_shares: 20, insurance_enabled: true
    }
  })

  const totalShares = watch('total_shares') || 10
  const minFarmerShares = Math.ceil(totalShares * 0.2)
  const costPrice = watch('cost_price') || 0
  const pricePerShare = watch('price_per_share') || 0
  const totalValue = totalShares * pricePerShare

  const isKycApproved = profile?.status === 'approved'
  const title = watch('title')
  const breed = watch('breed')
  const city = watch('city')
  const area = watch('area')
  const uploadedCount = previewUrls.length
  const listingSteps = [
    { label: 'Animal type', done: Boolean(title && breed) },
    { label: 'City/area', done: Boolean(city && area) },
    { label: 'Price plan', done: totalValue >= costPrice && watch('farmer_shares') >= minFarmerShares },
    { label: 'Photos/video', done: uploadedCount >= 3 },
  ]

  const applyAnimalTemplate = (template: typeof animalTemplates[number]) => {
    Object.entries(template.values).forEach(([key, value]) => {
      setValue(key as keyof FormData, value as any, { shouldDirty: true, shouldValidate: true })
    })
    setValue('insurance_enabled', true, { shouldDirty: true, shouldValidate: true })
  }

  const applyFinancePreset = (preset: typeof financePresets[number]) => {
    const cost = watch('cost_price') || 50000
    const price = Math.ceil(cost / preset.shares / 50) * 50
    setValue('total_shares', preset.shares, { shouldDirty: true, shouldValidate: true })
    setValue('price_per_share', Math.max(price, 100), { shouldDirty: true, shouldValidate: true })
    setValue('farmer_shares', Math.ceil(preset.shares * preset.farmerRatio), { shouldDirty: true, shouldValidate: true })
  }

  const fetchAiPricing = async () => {
    if (!watch('breed') || !watch('weight_kg') || !watch('age_months')) {
      alert('Please fill breed, weight, and age first')
      return
    }
    setAiLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('ai-service', {
        body: {
          action: 'suggest_pricing',
          payload: {
            breed: watch('breed'),
            age_months: watch('age_months'),
            weight_kg: watch('weight_kg'),
            location_city: watch('city'),
            season: 'current',
            health_score: 85
          }
        }
      })
      if (error) throw error
      if (data?.success) {
        setAiSuggestions(data.data)
        setValue('total_shares', data.data.recommended_total_shares)
        setValue('price_per_share', data.data.price_per_share)
        setValue('farmer_shares', data.data.farmer_min_shares)
      }
    } catch (err: any) {
      console.error('AI pricing error:', err)
      alert('Could not fetch AI suggestions. Please enter values manually.')
    } finally {
      setAiLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const urls = files.map(file => URL.createObjectURL(file))
    setPreviewUrls(prev => [...prev, ...urls])
  }

  const removePreview = (index: number) => {
    setPreviewUrls(prev => prev.filter((_, i) => i !== index))
  }

  const onSubmit = async (data: FormData) => {
    if (!profile) return
    if (!isKycApproved) {
      alert('Your KYC is not approved yet. You cannot list livestock for investment until your KYC is approved by admin.')
      return
    }
    setSubmitting(true)
    try {
      const basePayload = {
        farmer_id: profile.id,
        title: data.title,
        breed: data.breed,
        age_months: data.age_months,
        weight_kg: data.weight_kg,
        cost_price: data.cost_price,
        total_shares: data.total_shares,
        price_per_share: data.price_per_share,
        farmer_shares: data.farmer_shares,
        shares_available: data.total_shares - data.farmer_shares,
        status: 'draft',
        insurance_enabled: data.insurance_enabled
      }

      const insertLivestock = async () => {
        const firstAttempt = await supabase
          .from('livestock')
          .insert([{ ...basePayload, location: { city: data.city, area: data.area, country: 'Pakistan' }, area: data.area }])
          .select('id')
          .single()

        const firstError = firstAttempt.error?.message || ''
        if (!firstAttempt.error || !firstError.includes("'location' column")) return firstAttempt

        return supabase
          .from('livestock')
          .insert([{ ...basePayload, location_city: data.city, area: data.area }])
          .select('id')
          .single()
      }

      const { data: inserted, error } = await insertLivestock()
      
      if (error) throw error
      
      if (inserted?.id) {
        await supabase.from('livestock_updates').insert([{
          livestock_id: inserted.id,
          farmer_id: profile.id,
          weight_kg: data.weight_kg,
          health_status: 'healthy',
          notes: 'Initial listing'
        }])
      }
      
      alert('Livestock submitted. After admin screening, a veterinary partner will be assigned for medical clearance before investors can fund it.')
      navigate('/farmer/dashboard')
    } catch (err: any) {
      console.error('Submit error:', err)
      alert('❌ Error: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_10%,rgba(191,146,58,0.16),transparent_30%),linear-gradient(135deg,#fbf8ef_0%,#f7f2e8_46%,#edf5ef_100%)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-stone-600">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Create Financing Project</h1>
            <p className="text-stone-600">Set up livestock project for admin, vet, and insurance review</p>
          </div>
        </div>

        {/* KYC Warning Banner */}
        {!isKycApproved && (
          <Alert variant="default" className="mb-6 bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">KYC Required</AlertTitle>
            <AlertDescription className="text-yellow-700 text-sm">
              Your KYC is not approved yet. You cannot create financing projects. Please complete your KYC in 
              <Link to="/profile" className="ml-1 text-green-600 underline">Profile Settings</Link>.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <Card className="overflow-hidden border-0 bg-[#14261f] text-white shadow-[0_30px_80px_-34px_rgba(20,38,31,0.75)]">
            <CardContent className="p-0">
              <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
                <div className="p-6 sm:p-8 space-y-5">
                  <Badge className="w-fit bg-amber-300/15 text-amber-100 border border-amber-200/20">Smart Listing Assistant</Badge>
                  <div>
                    <h2 className="font-serif text-3xl font-bold">Farmer ko form nahi, sirf choices chahiye.</h2>
                    <p className="mt-2 text-sm text-emerald-50/75">Animal type choose karein, city tap karein, baqi project structure auto-fill ho jayega. Admin, doctor aur insurance team baad me verify karegi.</p>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3">
                    {animalTemplates.map((template) => (
                      <button
                        key={template.key}
                        type="button"
                        onClick={() => applyAnimalTemplate(template)}
                        className="rounded-lg border border-white/12 bg-white/8 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/14"
                      >
                        <Wand2 className="mb-3 h-5 w-5 text-amber-200" />
                        <p className="font-semibold">{template.label}</p>
                        <p className="mt-1 text-xs text-emerald-50/65">{template.hint}</p>
                      </button>
                    ))}
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100/70">Doctor city</p>
      <div className="flex flex-wrap gap-2">
                      <div className="w-full rounded-lg border border-white/12 bg-white/8 p-4 text-stone-950">
                        <PakistanLocationSelect
                          city={city}
                          area={area}
                          onCityChange={(value) => setValue('city', value, { shouldDirty: true, shouldValidate: true })}
                          onAreaChange={(value) => setValue('area', value, { shouldDirty: true, shouldValidate: true })}
                          cityLabel="Animal city/village"
                          areaLabel="Nearest area"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 bg-black/14 p-6 sm:p-8 lg:border-l lg:border-t-0">
                  <p className="mb-4 text-sm font-semibold text-emerald-50">Listing readiness</p>
                  <div className="space-y-3">
                    {listingSteps.map((step, index) => (
                      <div key={step.label} className="flex items-center gap-3 rounded-lg bg-white/8 p-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step.done ? 'bg-emerald-400 text-emerald-950' : 'bg-white/10 text-white/70'}`}>
                          {step.done ? <CheckCircle className="h-4 w-4" /> : index + 1}
                        </div>
                        <span className="text-sm text-emerald-50/85">{step.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-lg border border-amber-200/15 bg-amber-200/10 p-4 text-xs text-amber-50">
                    <ShieldCheck className="mb-2 h-4 w-4" />
                    Investor ko sirf vet-cleared, insured aur admin-approved animal hi visible hoga.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Info Card - same as before */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle>Basic Information</CardTitle><CardDescription>Enter details about your animal</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label>Title *</Label><Input {...register('title')} placeholder="e.g., Sahiwal Bull #102" />{errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}</div>
                <div className="space-y-2"><Label>Breed *</Label><Select onValueChange={(v) => setValue('breed', v)} defaultValue={watch('breed')}><SelectTrigger><SelectValue placeholder="Select breed" /></SelectTrigger><SelectContent><SelectItem value="Sahiwal">Sahiwal</SelectItem><SelectItem value="Cholistani">Cholistani</SelectItem><SelectItem value="Nili-Ravi">Nili-Ravi (Buffalo)</SelectItem><SelectItem value="Kundhi">Kundhi (Buffalo)</SelectItem><SelectItem value="Mixed">Mixed Breed</SelectItem></SelectContent></Select>{errors.breed && <p className="text-xs text-red-500">{errors.breed.message}</p>}</div>
                <div className="space-y-2"><Label>Age (Months) *</Label><Input type="number" {...register('age_months')} min={1} max={120} />{errors.age_months && <p className="text-xs text-red-500">{errors.age_months.message}</p>}</div>
                <div className="space-y-2"><Label>Current Weight (KG) *</Label><Input type="number" step="0.1" {...register('weight_kg')} min={10} />{errors.weight_kg && <p className="text-xs text-red-500">{errors.weight_kg.message}</p>}</div>
                <div className="md:col-span-2">
                  <PakistanLocationSelect
                    city={city}
                    area={area}
                    onCityChange={(value) => setValue('city', value, { shouldDirty: true, shouldValidate: true })}
                    onAreaChange={(value) => setValue('area', value, { shouldDirty: true, shouldValidate: true })}
                  />
                  {errors.city && <p className="mt-1 text-xs text-red-500">{errors.city.message}</p>}
                  {errors.area && <p className="mt-1 text-xs text-red-500">{errors.area.message}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financing Structure Card */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex justify-between items-center"><div><CardTitle>Financing Structure</CardTitle><CardDescription>Define project sizing and funding shares</CardDescription></div><Button type="button" variant="outline" size="sm" onClick={fetchAiPricing} disabled={aiLoading} className="flex items-center gap-2">{aiLoading ? <Sparkles className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4" />}AI Pricing Suggestion</Button></div>
            </CardHeader>
            <CardContent className="space-y-6">
              {aiSuggestions && (<Alert className="bg-blue-50 border-blue-200"><Sparkles className="h-4 w-4 text-blue-600" /><AlertTitle className="text-blue-800">AI Suggestions Applied</AlertTitle><AlertDescription className="text-blue-700 text-sm">Based on market data: PKR {aiSuggestions.price_per_share}/share • {aiSuggestions.recommended_total_shares} total shares • Expected ROI: {aiSuggestions.expected_roi_range?.min}-{aiSuggestions.expected_roi_range?.max}%</AlertDescription></Alert>)}
              <div className="grid md:grid-cols-3 gap-3">
                {financePresets.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => applyFinancePreset(preset)}
                    className="rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/60"
                  >
                    <p className="font-semibold text-stone-900">{preset.label}</p>
                    <p className="mt-1 text-xs text-stone-500">{preset.desc}</p>
                  </button>
                ))}
              </div>
              <div className="grid md:grid-cols-3 gap-6"><div className="space-y-2"><Label>Purchase Cost (PKR) *</Label><Input type="number" {...register('cost_price')} min={1000} />{errors.cost_price && <p className="text-xs text-red-500">{errors.cost_price.message}</p>}</div><div className="space-y-2"><Label>Total Shares *</Label><Input type="number" {...register('total_shares')} min={10} max={1000} />{errors.total_shares && <p className="text-xs text-red-500">{errors.total_shares.message}</p>}</div><div className="space-y-2"><Label>Price per Share (PKR) *</Label><Input type="number" {...register('price_per_share')} min={100} />{errors.price_per_share && <p className="text-xs text-red-500">{errors.price_per_share.message}</p>}</div></div>
              <div className="p-4 bg-stone-50 rounded-lg space-y-3"><div className="flex justify-between text-sm"><span className="text-stone-600">Total Value:</span><span className={`font-semibold ${totalValue >= costPrice ? 'text-green-600' : 'text-red-600'}`}>PKR {totalValue.toLocaleString()}</span></div><div className="flex justify-between text-sm"><span className="text-stone-600">Your Minimum Shares (20%):</span><span className="font-semibold">{minFarmerShares}</span></div><div className="space-y-2"><Label>Your Shares *</Label><Input type="number" {...register('farmer_shares')} min={1} />{watch('farmer_shares') < minFarmerShares && (<p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Must be at least {minFarmerShares} shares (20%)</p>)}{errors.farmer_shares && <p className="text-xs text-red-500">{errors.farmer_shares.message}</p>}</div></div>
              <div className="flex items-center gap-3 p-4 border rounded-lg"><Input type="checkbox" {...register('insurance_enabled')} className="w-4 h-4 accent-green-600" /><div><Label className="!mt-0 cursor-pointer">Enable Insurance Protection</Label><p className="text-xs text-stone-500">Risk cover will be issued after doctor clearance • Premium: ~2-3% of value</p></div></div>
            </CardContent>
          </Card>

          {/* Media Upload Card */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle>Media Upload</CardTitle><CardDescription>3 photos + 1 video required for admin and doctor review</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-stone-300 rounded-lg p-8 text-center hover:border-green-500 cursor-pointer transition bg-stone-50" onClick={() => fileInputRef.current?.click()}>
                <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
                <Camera className="h-8 w-8 text-stone-400 mx-auto mb-2" /><p className="text-sm text-stone-600">Photo/video add karein</p><p className="text-xs text-stone-400 mt-1">Side, front, back photo + walking video best hai</p>
              </div>
              {previewUrls.length > 0 && (<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{previewUrls.map((url, idx) => (<div key={idx} className="relative aspect-square bg-stone-100 rounded-lg overflow-hidden group">{url.endsWith('.mp4') || url.endsWith('.webm') ? <video src={url} className="w-full h-full object-cover" controls /> : <img src={url} alt={`Preview ${idx+1}`} className="w-full h-full object-cover" />}<button type="button" onClick={() => removePreview(idx)} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"><X className="h-3 w-3" /></button><Badge variant="secondary" className="absolute bottom-2 left-2 text-[10px]">{idx === 3 ? 'Video' : `Photo ${idx+1}`}</Badge></div>))}</div>)}
              <Alert variant="default" className="bg-yellow-50 border-yellow-200"><AlertCircle className="h-4 w-4 text-yellow-600" /><AlertTitle className="text-yellow-800 text-sm">Requirements</AlertTitle><AlertDescription className="text-yellow-700 text-xs mt-1">• Clear, well-lit photos showing full animal<br/>• Video must show animal walking & eating<br/>• No watermarks or edited content<br/>• All media will be reviewed by admin</AlertDescription></Alert>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={submitting || Object.keys(errors).length > 0 || !isKycApproved}>
              {submitting ? (
                <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span> Submitting...</span>
              ) : (
                <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> {!isKycApproved ? 'Complete KYC First' : 'Submit for Approval'}</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
