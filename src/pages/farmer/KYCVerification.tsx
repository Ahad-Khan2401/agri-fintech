import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { Badge } from '../../components/ui/Badge'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert'
import { AlertCircle, CheckCircle, Upload, FileText, Shield, ArrowLeft, Eye, X, Loader2 } from 'lucide-react'

export default function KYCVerification() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [kyc, setKyc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const [previewUrls, setPreviewUrls] = useState<{ [key: string]: string }>({})
  const [uploadedFiles, setUploadedFiles] = useState<{ [key: string]: File }>({})
  const fileInputs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  // Form text fields
  const [cnicNumber, setCnicNumber] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankName, setBankName] = useState('')
  const [farmLocation, setFarmLocation] = useState('')

  // Document types & requirements
  const documentTypes = [
    { key: 'cnic_front', label: 'CNIC Front *', accept: 'image/*', required: true, hint: 'Clear photo of CNIC front side' },
    { key: 'cnic_back', label: 'CNIC Back *', accept: 'image/*', required: true, hint: 'Clear photo of CNIC back side' },
    { key: 'selfie', label: 'Selfie with CNIC *', accept: 'image/*', required: true, hint: 'Hold CNIC next to your face, well-lit' },
    { key: 'bank_proof', label: 'Bank Proof *', accept: 'image/*,application/pdf', required: true, hint: 'Bank statement or IBAN screenshot' },
    { key: 'farm_proof', label: 'Farm Proof', accept: 'image/*,application/pdf', required: false, hint: 'Land document or utility bill (optional)' },
  ]

  useEffect(() => {
    if (profile) {
      loadKYC()
    }
  }, [profile])

  const loadKYC = async () => {
    try {
      const { data, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      const existingKyc = data?.[0]
      setKyc(existingKyc || null)
      
      // Pre-fill form if data exists
      if (existingKyc?.meta) {
        setCnicNumber(existingKyc.meta.cnic || '')
        setBankAccount(existingKyc.meta.bank_account || '')
        setFarmLocation(existingKyc.meta.farm_location || '')
      }
    } catch (err) {
      console.error('Failed to load KYC:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }
    
    const url = URL.createObjectURL(file)
    setPreviewUrls(prev => ({ ...prev, [key]: url }))
    setUploadedFiles(prev => ({ ...prev, [key]: file }))
  }

  const removePreview = (key: string) => {
    setPreviewUrls(prev => {
      const copy = { ...prev }
      delete copy[key]
      return copy
    })
    setUploadedFiles(prev => {
      const copy = { ...prev }
      delete copy[key]
      return copy
    })
    if (fileInputs.current[key]) {
      fileInputs.current[key].value = ''
    }
  }

  const uploadFileToStorage = async (file: File, key: string): Promise<string> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${key}_${Date.now()}.${fileExt}`
    const filePath = `${profile!.id}/${fileName}`
    
    // Simulate progress (supabase-js doesn't have onUploadProgress)
    setUploadProgress(prev => ({ ...prev, [key]: 50 }))
    
    const { error } = await supabase.storage
      .from('kyc-documents')
      .upload(filePath, file, { cacheControl: '3600', upsert: false })
    
    if (error) throw error
    
    setUploadProgress(prev => ({ ...prev, [key]: 100 }))
    
    return `storage://kyc-documents/${filePath}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    
    const missingRequired = documentTypes
      .filter(d => d.required)
      .filter(d => !uploadedFiles[d.key] && !previewUrls[d.key])
    
    if (missingRequired.length > 0) {
      alert(`Please upload: ${missingRequired.map(d => d.label).join(', ')}`)
      return
    }
    
    if (!cnicNumber.trim()) {
      alert('Please enter your CNIC number')
      return
    }
    if (!bankAccount.trim()) {
      alert('Please enter your bank account number')
      return
    }
    
    setSubmitting(true)
    
    try {
      // Upload files
      const fileUrls: { [key: string]: string } = {}
      for (const doc of documentTypes) {
        if (uploadedFiles[doc.key]) {
          const url = await uploadFileToStorage(uploadedFiles[doc.key], doc.key)
          fileUrls[doc.key] = url
        }
      }
      
      const upsertPayload = Object.entries(fileUrls).map(([document_type, file_url]) => ({
        user_id: profile.id,
        document_type,
        file_url,
        status: 'pending'
      }))

      if (upsertPayload.length > 0) {
        const docTypes = upsertPayload.map((d) => d.document_type)
        await supabase.from('kyc_documents').delete().eq('user_id', profile.id).in('document_type', docTypes)
        const { error: docsError } = await supabase.from('kyc_documents').insert(upsertPayload)
        if (docsError) throw docsError
      }

      await supabase.from('kyc_documents').delete().eq('user_id', profile.id).eq('document_type', 'meta')
      const { error: metaError } = await supabase.from('kyc_documents').insert([{
        user_id: profile.id,
        document_type: 'meta',
        file_url: '',
        meta: {
          cnic: cnicNumber,
          bank_account: bankAccount,
          bank_name: bankName,
          farm_location: farmLocation
        },
        status: 'pending'
      }])
      if (metaError) throw metaError
      
      // Update profile status
      await supabase.from('profiles').update({ status: 'pending' }).eq('id', profile.id)
      
      alert('✅ KYC submitted! Admin will review within 24-48 hours.')
      navigate('/farmer/dashboard')
    } catch (err: any) {
      console.error('KYC submit error:', err)
      alert('❌ Submission failed: ' + err.message)
    } finally {
      setSubmitting(false)
      setUploadProgress({})
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4" />
          <p className="text-stone-600">Loading KYC status...</p>
        </div>
      </div>
    )
  }

  if (profile?.status === 'approved' && kyc?.status === 'approved') {
    navigate('/farmer/dashboard')
    return null
  }

  const statusConfig: any = {
    approved: { 
      bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', 
      icon: <CheckCircle className="h-5 w-5 text-green-600" />,
      title: '✓ Verified',
      desc: 'You can now list livestock and access all farmer features.'
    },
    rejected: { 
      bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800',
      icon: <AlertCircle className="h-5 w-5 text-red-600" />,
      title: '✗ Rejected',
      desc: `Reason: ${kyc?.admin_notes || 'Documents unclear'}. Please re-submit with clearer images.`
    },
    pending: { 
      bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800',
      icon: <AlertCircle className="h-5 w-5 text-yellow-600" />,
      title: '⏳ Under Review',
      desc: 'Your documents are being verified. You\'ll be notified via email/SMS once approved.'
    },
  }
  const status = statusConfig[kyc?.status || 'pending']

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-stone-600">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Farmer KYC Verification</h1>
            <p className="text-stone-600">Mandatory for listing livestock • Takes 2-3 minutes</p>
          </div>
        </div>

        <Alert className={`${status.bg} ${status.border} mb-8`}>
          {status.icon}
          <AlertTitle className={status.text}>{status.title}</AlertTitle>
          <AlertDescription className={`${status.text} text-sm mt-1`}>
            {status.desc}
          </AlertDescription>
        </Alert>

        {kyc?.status !== 'approved' && (
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Personal Info */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Enter your details as they appear on your CNIC</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>CNIC Number *</Label>
                    <Input 
                      placeholder="35202-1234567-1" 
                      value={cnicNumber}
                      onChange={e => setCnicNumber(e.target.value)}
                      pattern="\d{5}-\d{7}-\d"
                      required
                    />
                    <p className="text-xs text-stone-500">Format: XXXXX-XXXXXXX-X</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Full Name (as on CNIC) *</Label>
                    <Input defaultValue={profile?.full_name || user?.user_metadata?.full_name} disabled />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Document Uploads */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Document Uploads</CardTitle>
                <CardDescription>Clear, well-lit photos required for verification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {documentTypes.map((doc) => (
                  <div key={doc.key} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>{doc.label}</Label>
                      {doc.required && <Badge variant="outline" className="text-[10px]">Required</Badge>}
                    </div>
                    <p className="text-xs text-stone-500">{doc.hint}</p>
                    
                    {!previewUrls[doc.key] ? (
                      <div 
                        className="border-2 border-dashed border-stone-300 rounded-lg p-6 text-center hover:border-green-500 cursor-pointer transition bg-stone-50"
                        onClick={() => fileInputs.current[doc.key]?.click()}
                      >
                        <input 
                          ref={el => fileInputs.current[doc.key] = el}
                          type="file" 
                          accept={doc.accept}
                          className="hidden"
                          onChange={(e) => handleFileSelect(doc.key, e)}
                        />
                        <Upload className="h-6 w-6 text-stone-400 mx-auto mb-2" />
                        <p className="text-sm text-stone-600">Click to upload</p>
                        <p className="text-xs text-stone-400 mt-1">Supported: JPG, PNG, PDF (max 10MB)</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="aspect-video bg-stone-100 rounded-lg overflow-hidden">
                          {previewUrls[doc.key].endsWith('.pdf') ? (
                            <div className="w-full h-full flex items-center justify-center text-stone-400">
                              <FileText className="h-8 w-8" />
                              <span className="ml-2 text-sm">PDF Preview</span>
                            </div>
                          ) : (
                            <img src={previewUrls[doc.key]} alt={doc.label} className="w-full h-full object-contain" />
                          )}
                        </div>
                        
                        {uploadProgress[doc.key] !== undefined && uploadProgress[doc.key] < 100 && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2">
                            <div className="bg-white rounded-full h-2">
                              <div className="bg-green-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress[doc.key]}%` }} />
                            </div>
                            <p className="text-xs text-white text-center mt-1">Uploading: {uploadProgress[doc.key]}%</p>
                          </div>
                        )}
                        
                        <button 
                          type="button"
                          onClick={() => removePreview(doc.key)}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <Badge variant="secondary" className="absolute bottom-2 left-2 text-[10px]">
                          <Eye className="h-3 w-3 mr-1" /> Preview
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}

                <Alert variant="default" className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800 text-sm">Tips for Approval</AlertTitle>
                  <AlertDescription className="text-blue-700 text-xs mt-1">
                    • Ensure CNIC text is clearly readable<br/>
                    • Selfie must show your face AND CNIC together<br/>
                    • No glare, shadows, or blurred images<br/>
                    • All documents must be valid and not expired
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Bank Details */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Bank Account for Payouts</CardTitle>
                <CardDescription>Where you'll receive your profit shares</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Bank Account Number / IBAN *</Label>
                  <Input 
                    placeholder="PK36SCBL0000001123456702" 
                    value={bankAccount}
                    onChange={e => setBankAccount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bank Name *</Label>
                  <Input 
                    placeholder="e.g., HBL, UBL, MCB"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Farm Location (Optional)</Label>
                  <Input 
                    placeholder="Village, Tehsil, District" 
                    value={farmLocation}
                    onChange={e => setFarmLocation(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Consent */}
            <Card className="border-0 shadow-sm bg-stone-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-stone-900">Privacy & Consent</p>
                    <p className="text-sm text-stone-600 mt-1">
                      By submitting, you consent to MaweshiHub verifying your identity and documents. 
                      Your data is encrypted, stored securely, and used solely for KYC compliance.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="animate-spin h-4 w-4" />
                    Uploading & Submitting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" /> Submit for Verification
                  </span>
                )}
              </Button>
            </div>
          </form>
        )}

        {kyc?.status === 'rejected' && (
          <div className="mt-8 pt-6 border-t">
            <Button onClick={() => { setKyc(null); setUploadedFiles({}); setPreviewUrls({}); }} variant="outline" className="w-full">
              Re-submit Documents
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
