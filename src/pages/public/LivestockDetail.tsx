import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { useWallet } from '../../store/wallet'
import { useAI } from '../../hooks/useAI'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../../components/ui/Dialog'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert'
import { formatCurrency, formatDate } from '../../lib/utils'
import { 
  ArrowLeft, Share2, Heart, MapPin, Weight, Shield, AlertCircle, 
  CheckCircle, Brain, FileText, Clock, Languages, Video, 
  Stethoscope
} from 'lucide-react'

export default function LivestockDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { invest } = useWallet()
  const { predictHealth, detectFraud, generateShariahReport, chat, loading: aiLoading } = useAI()
  
  const [livestock, setLivestock] = useState<any>(null)
  const [vetReport, setVetReport] = useState<any>(null)
  const [insurance, setInsurance] = useState<any>(null)
  const [updates, setUpdates] = useState<any[]>([])
  const [shares, setShares] = useState(1)
  const [investing, setInvesting] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [aiInsights, setAiInsights] = useState<{ health?: any; fraud?: any; shariah?: any }>({})
  const [language, setLanguage] = useState<'ur' | 'en'>('ur')
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([])
  const [chatInput, setChatInput] = useState('')

  // Load livestock data
  useEffect(() => {
    if (!id) return
    loadLivestock()
    loadVetReport()
    loadInsurance()
    loadUpdates()
  }, [id])

  // Load AI insights when livestock is ready
  useEffect(() => {
    if (livestock?.status === 'active') {
      loadAIInsights()
    }
  }, [livestock?.id, livestock?.status])

  const loadLivestock = async () => {
    const { data, error } = await supabase
      .from('livestock')
      .select('*, farmer:profiles(phone, status, full_name)')
      .eq('id', id)
      .single()
    
    if (!error && data) setLivestock(data)
  }

  const loadVetReport = async () => {
    const { data } = await supabase
      .from('vet_reports')
      .select('*')
      .eq('livestock_id', id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (data) setVetReport(data)
  }

  const loadInsurance = async () => {
    const { data } = await supabase
      .from('insurance_policies')
      .select('*')
      .eq('livestock_id', id)
      .eq('status', 'active')
      .limit(1)
      .single()
    
    if (data) setInsurance(data)
  }

  const loadUpdates = async () => {
    const { data } = await supabase
      .from('livestock_updates')
      .select('*')
      .eq('livestock_id', id)
      .order('created_at', { ascending: false })
      .limit(5)
    
    setUpdates(data || [])
  }

  const loadAIInsights = async () => {
    if (!livestock) return
    
    const [healthRes, fraudRes, shariahRes] = await Promise.all([
      predictHealth(livestock),
      detectFraud(livestock),
      generateShariahReport(livestock)
    ])
    
    setAiInsights({
      health: healthRes.success ? healthRes.data : null,
      fraud: fraudRes.success ? fraudRes.data : null,
      shariah: shariahRes.success ? shariahRes.data : null
    })
  }

 const handleInvest = async () => {
  if (!profile) return navigate('/login')
  
  // ✅ Check if investor KYC is approved
  if (profile.role === 'investor' && profile.status !== 'approved') {
    alert('Your KYC is not approved yet. Please complete KYC in Profile Settings to invest.')
    return
  }
  
  setInvesting(true)
  const res = await invest(livestock.id, shares)

    
    if (res.success) {
      setShowDialog(false)
      navigate('/investor/investments')
    } else {
      alert(res.error || 'Investment failed')
    }
    setInvesting(false)
  }

  const handleChatSend = async () => {
    if (!chatInput.trim() || !livestock) return
    
    const userMsg = chatInput
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setChatInput('')
    
    const res = await chat(userMsg, language, {
      livestock: { title: livestock.title, breed: livestock.breed, status: livestock.status },
      role: profile?.role
    })
    
    if (res.success && res.data?.reply) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }])
    }
  }

  if (!livestock) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-stone-600">Loading livestock details...</p>
        </div>
      </div>
    )
  }

  const maxShares = Math.min(shares, livestock.shares_available)
  const amount = livestock.price_per_share * maxShares
  const ownership = ((maxShares / livestock.total_shares) * 100).toFixed(2)
  const fundedPercent = Math.round(((livestock.total_shares - livestock.shares_available) / livestock.total_shares) * 100)
  
  const t = {
    en: {
      back: 'Back to Listings',
      invest: 'Invest Now',
      pricePerShare: 'Price per share',
      shares: 'Shares',
      total: 'Total Investment',
      ownership: 'Your Ownership',
      estReturn: 'Est. Return (18-24%)',
      confirm: 'Confirm Investment',
      riskWarning: 'Livestock investment carries risk. Returns are profit-sharing based (Mudarabah) and not guaranteed.',
      vetReport: 'Veterinary Report',
      insurance: 'Insurance Coverage',
      aiHealth: 'AI Health Analysis',
      aiFraud: 'Security Check',
      shariah: 'Shariah Compliance',
      updates: 'Recent Updates',
      noUpdates: 'No updates yet',
      chatPlaceholder: 'Ask about this livestock in Urdu or English...',
      send: 'Send'
    },
    ur: {
      back: 'واپس لسٹنگ پر',
      invest: 'ابھی انویسٹ کریں',
      pricePerShare: 'فی شیئر قیمت',
      shares: 'شیئرز',
      total: 'کل انویسٹمنٹ',
      ownership: 'آپ کی ملکیت',
      estReturn: 'متوقع منافع (18-24%)',
      confirm: 'تصدیق کریں',
      riskWarning: 'مویشی انویسٹمنٹ میں رسک شامل ہے۔ منافع شیئرنگ پر مبنی ہے اور گارنٹیڈ نہیں ہے۔',
      vetReport: 'ویٹنری رپورٹ',
      insurance: 'انویسٹمنٹ کوریج',
      aiHealth: 'AI صحت کا تجزیہ',
      aiFraud: 'سیکیورٹی چیک',
      shariah: 'شرعی مطابقت',
      updates: 'تازہ ترین اپڈیٹس',
      noUpdates: 'ابھی تک کوئی اپڈیٹ نہیں',
      chatPlaceholder: 'اس مویشی کے بارے میں اردو یا انگریزی میں پوچھیں...',
      send: 'بھیجیں'
    }
  }[language]

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate(-1)} className="text-stone-600">
              <ArrowLeft className="h-4 w-4 mr-2" /> {t.back}
            </Button>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setLanguage(l => l === 'en' ? 'ur' : 'en')}
                className="flex items-center gap-1"
              >
                <Languages className="h-4 w-4" />
                {language.toUpperCase()}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Media + Info + AI Insights */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Media Gallery */}
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className="h-64 sm:h-80 bg-stone-200 relative flex items-center justify-center">
                {livestock.media_urls?.[0] ? (
                  <img src={livestock.media_urls[0]} alt={livestock.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <Video className="h-12 w-12 text-stone-400 mx-auto mb-2" />
                    <p className="text-stone-500">Media loading...</p>
                  </div>
                )}
                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="bg-white/90">{livestock.breed}</Badge>
                  {livestock.insurance_enabled && (
                    <Badge variant="success" className="bg-green-500/90 text-white">
                      <Shield className="h-3 w-3 mr-1" /> Insured
                    </Badge>
                  )}
                  {vetReport && (
                    <Badge variant="outline" className="bg-white/90">
                      <Stethoscope className="h-3 w-3 mr-1" /> Vet Approved
                    </Badge>
                  )}
                </div>
                {livestock.media_urls?.length > 1 && (
                  <div className="absolute bottom-4 right-4 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {livestock.media_urls.length} media items
                  </div>
                )}
              </div>
            </Card>

            {/* Basic Info */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6 space-y-6">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">{livestock.title}</h1>
                    <p className="text-stone-600 flex flex-wrap items-center gap-2 mt-1 text-sm">
                      <MapPin className="h-4 w-4" /> {livestock.location_city || 'Pakistan'} 
                      • {livestock.age_months} months • {livestock.weight_kg} kg
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon"><Share2 className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon"><Heart className="h-4 w-4" /></Button>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-stone-50 rounded-lg">
                  <div>
                    <p className="text-xs text-stone-500 uppercase">Weight</p>
                    <p className="font-bold text-stone-900 flex items-center gap-1">
                      <Weight className="h-4 w-4 text-green-600" /> {livestock.weight_kg} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 uppercase">Cost</p>
                    <p className="font-bold text-stone-900">{formatCurrency(livestock.cost_price)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 uppercase">Funding</p>
                    <p className="font-bold text-stone-900">{fundedPercent}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 uppercase">Farmer</p>
                    <p className="font-bold text-stone-900">{Math.round((livestock.farmer_shares/livestock.total_shares)*100)}%</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-stone-600">{livestock.shares_available} shares left</span>
                    <span className="font-medium text-green-600">{fundedPercent}% Funded</span>
                  </div>
                  <div className="w-full bg-stone-200 rounded-full h-2.5">
                    <div className="bg-green-600 h-2.5 rounded-full transition-all" style={{ width: `${fundedPercent}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Insights Section */}
            {livestock.status === 'active' && (
              <div className="space-y-4">
                
                {/* Fraud Check */}
                {aiInsights.fraud && (
                  <Card className={`border-0 shadow-sm ${
                    aiInsights.fraud.risk_level === 'blocked' ? 'bg-red-50 border border-red-200' :
                    aiInsights.fraud.risk_level === 'high_risk' ? 'bg-orange-50 border border-orange-200' :
                    'bg-green-50 border border-green-200'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Shield className={`h-5 w-5 mt-0.5 ${
                          aiInsights.fraud.risk_level === 'safe' ? 'text-green-600' : 'text-orange-600'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-stone-900">{t.aiFraud}</p>
                            <Badge variant={
                              aiInsights.fraud.risk_level === 'safe' ? 'success' :
                              aiInsights.fraud.risk_level === 'caution' ? 'warning' : 'destructive'
                            }>
                              {aiInsights.fraud.fraud_score}/100
                            </Badge>
                          </div>
                          <p className="text-sm text-stone-600">{aiInsights.fraud.explanation}</p>
                          {aiInsights.fraud.flags?.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-stone-500 cursor-pointer">View details</summary>
                              <ul className="mt-2 space-y-1">
                                {aiInsights.fraud.flags.map((flag: any, i: number) => (
                                  <li key={i} className="text-xs text-stone-600 flex items-start gap-1">
                                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                    {flag.description}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Shariah Compliance */}
                {aiInsights.shariah && (
                  <Card className="border-0 shadow-sm bg-blue-50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-stone-900">{t.shariah}</p>
                            <Badge variant={aiInsights.shariah.is_compliant ? 'success' : 'warning'}>
                              {aiInsights.shariah.is_compliant ? '✓ Compliant' : '⚠ Review'}
                            </Badge>
                          </div>
                          <p className="text-sm text-stone-700">{language === 'ur' ? aiInsights.shariah.summary_ur : aiInsights.shariah.summary_en}</p>
                          {aiInsights.shariah.conditions?.length > 0 && (
                            <p className="text-xs text-stone-500 mt-1">
                              Conditions: {aiInsights.shariah.conditions.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Health Prediction */}
                {aiInsights.health && (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Brain className="h-5 w-5 text-purple-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-stone-900">{t.aiHealth}</p>
                            <Badge variant={
                              aiInsights.health.risk_level === 'low' ? 'success' :
                              aiInsights.health.risk_level === 'medium' ? 'warning' : 'destructive'
                            }>
                              {aiInsights.health.risk_level} risk
                            </Badge>
                          </div>
                          <p className="text-sm text-stone-600">
                            Risk Score: {aiInsights.health.risk_score}% • Confidence: {Math.round(aiInsights.health.confidence * 100)}%
                          </p>
                          {aiInsights.health.recommendations?.length > 0 && (
                            <ul className="mt-2 text-xs text-stone-600 list-disc list-inside">
                              {aiInsights.health.recommendations.slice(0, 2).map((rec: string, i: number) => (
                                <li key={i}>{rec}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Vet Report */}
            {vetReport && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Stethoscope className="h-5 w-5 text-green-600" />
                    {t.vetReport}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-stone-500">Health Status</p>
                      <p className="font-medium capitalize">{vetReport.health_status}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Fit for Investment</p>
                      <p className="font-medium">{vetReport.fit_for_investment ? '✓ Yes' : '✗ No'}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Inspection Date</p>
                      <p className="font-medium">{formatDate(vetReport.inspection_date)}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Vet</p>
                      <p className="font-medium">Dr. {vetReport.vet_name || 'Verified'}</p>
                    </div>
                  </div>
                  {vetReport.vet_notes && (
                    <p className="text-sm text-stone-600 italic">"{vetReport.vet_notes}"</p>
                  )}
                  {vetReport.report_pdf_url && (
                    <a href={vetReport.report_pdf_url} target="_blank" rel="noreferrer" className="text-sm text-green-600 hover:underline">
                      View Full Report →
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Insurance */}
            {insurance && (
              <Card className="border-0 shadow-sm bg-green-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    {t.insurance}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-600">Provider</span>
                    <span className="font-medium">{insurance.provider_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Coverage</span>
                    <span className="font-medium">{formatCurrency(insurance.coverage_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Valid Until</span>
                    <span className="font-medium">{formatDate(insurance.end_date)}</span>
                  </div>
                  <p className="text-xs text-stone-500 mt-2">
                    Covered: {insurance.covered_risks?.join(', ') || 'Standard risks'}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Updates Timeline */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-stone-600" />
                  {t.updates}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {updates.length === 0 ? (
                  <p className="text-stone-500 text-sm">{t.noUpdates}</p>
                ) : (
                  <div className="space-y-4">
                    {updates.map((u: any) => (
                      <div key={u.id} className="flex gap-3 pb-4 border-b border-stone-100 last:border-0 last:pb-0">
                        <div className="w-2 h-2 bg-green-600 rounded-full mt-2" />
                        <div className="flex-1">
                          <p className="text-xs text-stone-500">{formatDate(u.created_at)}</p>
                          <p className="text-sm text-stone-700">
                            {u.health_status && <span className="font-medium">Health: {u.health_status}</span>}
                            {u.weight_kg && <span className="text-stone-600"> • Weight: {u.weight_kg}kg</span>}
                          </p>
                          {u.notes && <p className="text-sm text-stone-600 mt-1">{u.notes}</p>}
                          {u.media_url && (
                            <a href={u.media_url} target="_blank" rel="noreferrer" className="text-xs text-green-600 hover:underline mt-1 inline-block">
                              View media →
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* RIGHT COLUMN: Investment Panel */}
          <div className="space-y-6">
            <Card className="border-0 shadow-md sticky top-24">
              <CardContent className="p-6 space-y-6">
                
                {/* Price */}
                <div>
                  <p className="text-sm text-stone-500">{t.pricePerShare}</p>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(livestock.price_per_share)}</p>
                </div>

                {/* Shares Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">{t.shares}</label>
                  <Input 
                    type="number" 
                    min={1} 
                    max={livestock.shares_available} 
                    value={shares} 
                    onChange={e => setShares(Math.max(1, Math.min(parseInt(e.target.value) || 1, livestock.shares_available)))}
                    className="text-lg"
                    disabled={livestock.shares_available === 0}
                  />
                  <p className="text-xs text-stone-500">Available: {livestock.shares_available}</p>
                </div>

                {/* Summary */}
                <div className="p-4 bg-stone-50 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-600">{t.total}</span>
                    <span className="font-bold">{formatCurrency(amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">{t.ownership}</span>
                    <span className="font-bold">{ownership}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">{t.estReturn}</span>
                    <span className="font-bold text-green-600">+{formatCurrency(amount * 0.21)}</span>
                  </div>
                </div>

                {/* Invest Button */}
                <Dialog open={showDialog} onOpenChange={setShowDialog}>
                  <DialogTrigger asChild>
  <Button className="w-full h-12 text-lg bg-green-600 hover:bg-green-700" 
    disabled={livestock.shares_available === 0 || livestock.status !== 'active' || (profile?.role === 'investor' && profile?.status !== 'approved')}>
    {livestock.shares_available === 0 ? 'Fully Funded' : livestock.status !== 'active' ? 'Not Available' : !profile ? 'Login to Invest' : (profile.role === 'investor' && profile.status !== 'approved') ? 'Complete KYC to Invest' : t.invest}
  </Button>
</DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>{t.confirm}</DialogTitle>
                      <DialogDescription className="text-stone-600">
                        Review your investment details before confirming.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      
                      {/* Risk Warning */}
                      <Alert variant="default" className="bg-yellow-50 border-yellow-200">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <AlertTitle className="text-yellow-800 text-sm">Important</AlertTitle>
                        <AlertDescription className="text-yellow-700 text-xs mt-1">
                          {t.riskWarning}
                        </AlertDescription>
                      </Alert>

                      {/* Details */}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Animal</span><strong className="text-stone-900">{livestock.title}</strong></div>
                        <div className="flex justify-between"><span>Shares</span><strong>{maxShares}</strong></div>
                        <div className="flex justify-between"><span>Amount</span><strong>{formatCurrency(amount)}</strong></div>
                        <div className="flex justify-between"><span>Ownership</span><strong>{ownership}%</strong></div>
                        <div className="flex justify-between"><span>Farmer Stake</span><strong>{Math.round((livestock.farmer_shares/livestock.total_shares)*100)}%</strong></div>
                      </div>

                      {/* Confirm */}
                      <Button className="w-full h-11 bg-green-600 hover:bg-green-700" onClick={handleInvest} disabled={investing}>
                        {investing ? (
                          <span className="flex items-center gap-2">
                            <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                            Processing...
                          </span>
                        ) : `${t.confirm} • ${formatCurrency(amount)}`}
                      </Button>
                      
                      <p className="text-xs text-center text-stone-500">
                        Funds held in escrow • Secure transaction
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Trust Badges */}
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <div className="flex items-center gap-1 text-xs text-stone-600">
                    <CheckCircle className="h-3 w-3 text-green-600" /> Verified Farmer
                  </div>
                  <div className="flex items-center gap-1 text-xs text-stone-600">
                    <Shield className="h-3 w-3 text-green-600" /> Escrow Protected
                  </div>
                  {vetReport && (
                    <div className="flex items-center gap-1 text-xs text-stone-600">
                      <Stethoscope className="h-3 w-3 text-green-600" /> Vet Approved
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>

            {/* Farmer Info */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-semibold">
                    {livestock.farmer?.full_name?.[0]?.toUpperCase() || 'F'}
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">{livestock.farmer?.full_name || 'Verified Farmer'}</p>
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      {livestock.farmer?.status === 'approved' && (
                        <Badge variant="success" className="text-[10px] px-1 py-0">✓ KYC Verified</Badge>
                      )}
                      <span>📱 {livestock.farmer?.phone?.slice(0, 4)}****</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>

      {/* AI Chat Assistant (Floating) */}
      {chatOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-stone-200 z-50 overflow-hidden">
          <div className="p-3 bg-green-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              <span className="font-medium">MaweshiGuide AI</span>
            </div>
            <button onClick={() => setChatOpen(false)} className="p-1 hover:bg-white/20 rounded">
              ✕
            </button>
          </div>
          <div className="h-64 overflow-y-auto p-3 space-y-3 bg-stone-50">
            {chatMessages.length === 0 && (
              <p className="text-xs text-stone-500 text-center py-4">
                Ask me anything about this livestock in Urdu or English!
              </p>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-lg text-sm ${
                  msg.role === 'user' 
                    ? 'bg-green-600 text-white rounded-br-none' 
                    : 'bg-white border border-stone-200 rounded-bl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-stone-200 p-3 rounded-lg rounded-bl-none">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                    <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-stone-200 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChatSend()}
              placeholder={t.chatPlaceholder}
              className="flex-1 px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <Button size="sm" onClick={handleChatSend} disabled={!chatInput.trim() || aiLoading}>
              {t.send}
            </Button>
          </div>
        </div>
      )}

      {/* Chat Toggle Button */}
      <button 
        onClick={() => setChatOpen(o => !o)}
        className="fixed bottom-6 right-4 sm:right-6 z-50 h-14 w-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
      >
        {chatOpen ? '✕' : <Languages className="h-6 w-6" />}
      </button>
    </div>
  )
}
