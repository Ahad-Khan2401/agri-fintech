import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert'
import { ArrowLeft, Stethoscope, CheckCircle, AlertCircle, Loader2, FileText, Upload, X } from 'lucide-react'

export default function VetReport() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [livestock, setLivestock] = useState<any>(null)
  const [vetReport, setVetReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  const [healthStatus, setHealthStatus] = useState('')
  const [weight, setWeight] = useState('')
  const [temperature, setTemperature] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [notes, setNotes] = useState('')
  const [reportFile, setReportFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (profile && id) {
      loadData()
    }
  }, [profile, id])

  const loadData = async () => {
    try {
      const { data: livestockData, error: livestockError } = await supabase
        .from('livestock')
        .select('*')
        .eq('id', id)
        .eq('farmer_id', profile!.id)
        .single()
      
      if (livestockError) throw livestockError
      setLivestock(livestockData)
      
      const { data: reportData, error: reportError } = await supabase
        .from('vet_reports')
        .select('*')
        .eq('livestock_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (!reportError && reportData) {
        setVetReport(reportData)
        setHealthStatus(reportData.health_status || '')
        setWeight(reportData.weight_kg?.toString() || '')
        setTemperature(reportData.temperature_f?.toString() || '')
        setHeartRate(reportData.heart_rate_bpm?.toString() || '')
        setNotes(reportData.vet_notes || '')
      }
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReportFile(file)
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const uploadReport = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `vet_report_${Date.now()}.${fileExt}`
    const filePath = `${profile!.id}/vet/${fileName}`
    
    const { error } = await supabase.storage
      .from('vet-reports')
      .upload(filePath, file, { cacheControl: '3600' })
    
    if (error) throw error
    
    const { data: urlData } = supabase.storage
      .from('vet-reports')
      .getPublicUrl(filePath)
    
    return urlData.publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !id || !healthStatus) {
      alert('Please select a health status')
      return
    }
    setSubmitting(true)
    
    try {
      let reportUrl = null
      if (reportFile) {
        reportUrl = await uploadReport(reportFile)
      }
      
      const { error } = await supabase.from('vet_reports').upsert([{
        livestock_id: id,
        vet_id: null, // In production: actual vet user ID after role implementation
        weight_kg: weight ? parseFloat(weight) : null,
        temperature_f: temperature ? parseFloat(temperature) : null,
        heart_rate_bpm: heartRate ? parseInt(heartRate) : null,
        health_status: healthStatus,
        vet_notes: notes || null,
        report_pdf_url: reportUrl,
        fit_for_investment: healthStatus === 'excellent' || healthStatus === 'good',
        status: 'submitted',
        inspection_date: new Date().toISOString()
      }])
      
      if (error) throw error
      
      // If first report and health is good, update livestock status to active
      if (!vetReport && ['excellent', 'good'].includes(healthStatus)) {
        await supabase.from('livestock').update({ status: 'active' }).eq('id', id)
      }
      
      alert('✅ Vet report submitted! Admin will review for activation.')
      navigate(-1)
    } catch (err: any) {
      console.error('Vet report error:', err)
      alert('❌ Failed to submit report: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4" />
          <p className="text-stone-600">Loading vet report...</p>
        </div>
      </div>
    )
  }

  if (!livestock) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Card className="border-0 shadow-sm max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-stone-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-stone-900 mb-2">Livestock Not Found</h3>
            <p className="text-stone-600 mb-6">This animal doesn't exist or you don't have permission.</p>
            <Button onClick={() => navigate('/farmer/dashboard')}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const healthOptions = [
    { value: 'excellent', label: 'Excellent', color: 'bg-green-100 text-green-800' },
    { value: 'good', label: 'Good', color: 'bg-blue-100 text-blue-800' },
    { value: 'fair', label: 'Fair', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'poor', label: 'Poor', color: 'bg-orange-100 text-orange-800' },
    { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
  ]

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-stone-600">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Veterinary Report</h1>
            <p className="text-stone-600">Health assessment for {livestock.title}</p>
          </div>
        </div>

        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-stone-200 rounded-lg flex items-center justify-center">
                <span className="text-stone-400 text-xs">Img</span>
              </div>
              <div>
                <h3 className="font-bold text-stone-900">{livestock.title}</h3>
                <p className="text-sm text-stone-600">
                  {livestock.breed} • {livestock.age_months} months • {livestock.weight_kg} kg
                </p>
                <Badge variant="outline" className="mt-1">{livestock.location_city}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {vetReport && (
          <Alert className="bg-blue-50 border-blue-200 mb-6">
            <FileText className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Previous Report Found</AlertTitle>
            <AlertDescription className="text-blue-700 text-sm mt-1">
              Last inspection: {new Date(vetReport.inspection_date).toLocaleDateString()} • 
              Status: <Badge className={healthOptions.find(h => h.value === vetReport.health_status)?.color}>{vetReport.health_status}</Badge>
              {vetReport.report_pdf_url && (
                <a href={vetReport.report_pdf_url} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 hover:underline">
                  View Report →
                </a>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-green-600" />
              <CardTitle>Health Assessment</CardTitle>
            </div>
            <CardDescription>Record vital signs and health observations</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              
              <div className="space-y-2">
                <Label>Overall Health Status *</Label>
                <Select value={healthStatus} onValueChange={setHealthStatus}>
                  <SelectTrigger><SelectValue placeholder="Select health status" /></SelectTrigger>
                  <SelectContent>
                    {healthOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className={`flex items-center gap-2 ${opt.color} px-2 py-1 rounded`}>
                          {opt.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {healthStatus && (
                  <Alert variant="default" className={`text-xs ${
                    ['excellent', 'good'].includes(healthStatus) ? 'bg-green-50 border-green-200' :
                    healthStatus === 'fair' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-red-50 border-red-200'
                  }`}>
                    {['excellent', 'good'].includes(healthStatus) ? (
                      <>
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <AlertDescription className="text-green-700">
                          ✓ Animal is fit for investment • Can be activated for public listing
                        </AlertDescription>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 text-orange-600" />
                        <AlertDescription className="text-orange-700">
                          ⚠ Animal requires monitoring • Will not be activated until health improves
                        </AlertDescription>
                      </>
                    )}
                  </Alert>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Weight (KG)</Label>
                  <Input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder={livestock.weight_kg.toString()} />
                </div>
                <div className="space-y-2">
                  <Label>Temperature (°F)</Label>
                  <Input type="number" step="0.1" value={temperature} onChange={e => setTemperature(e.target.value)} placeholder="101.5" />
                </div>
                <div className="space-y-2">
                  <Label>Heart Rate (BPM)</Label>
                  <Input type="number" value={heartRate} onChange={e => setHeartRate(e.target.value)} placeholder="60" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Veterinarian Notes</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observations, diagnosis, treatment recommendations, etc." />
              </div>

              <div className="space-y-2">
                <Label>Official Report (Optional)</Label>
                {!previewUrl ? (
                  <div 
                    className="border-2 border-dashed border-stone-300 rounded-lg p-6 text-center hover:border-green-500 cursor-pointer transition bg-stone-50"
                    onClick={() => document.getElementById('vet-report-file')?.click()}
                  >
                    <input id="vet-report-file" type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
                    <Upload className="h-6 w-6 text-stone-400 mx-auto mb-2" />
                    <p className="text-sm text-stone-600">Upload vet certificate or lab report</p>
                    <p className="text-xs text-stone-400 mt-1">Supported: JPG, PNG, PDF (max 10MB)</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="aspect-video bg-stone-100 rounded-lg overflow-hidden">
                      {reportFile?.type === 'application/pdf' ? (
                        <div className="w-full h-full flex items-center justify-center text-stone-400">
                          <FileText className="h-8 w-8" />
                          <span className="ml-2 text-sm">PDF Preview</span>
                        </div>
                      ) : (
                        <img src={previewUrl} alt="Report preview" className="w-full h-full object-contain" />
                      )}
                    </div>
                    <button type="button" onClick={() => { setPreviewUrl(null); setReportFile(null); }} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={submitting || !healthStatus}>
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="animate-spin h-4 w-4" />
                      Submitting...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" /> Submit Report
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>

        <Card className="border-0 shadow-sm mt-6 bg-gradient-to-br from-purple-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Stethoscope className="h-5 w-5 text-purple-600 mt-0.5" />
              <div>
                <p className="font-medium text-stone-900">Why Vet Reports Matter</p>
                <ul className="text-sm text-stone-600 mt-1 space-y-1">
                  <li>• Mandatory for activating livestock for public investment</li>
                  <li>• Protects investors from unhealthy animals</li>
                  <li>• Builds trust through transparent health tracking</li>
                  <li>• Required for insurance eligibility</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
