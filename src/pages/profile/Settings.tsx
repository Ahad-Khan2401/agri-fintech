import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { Badge } from '../../components/ui/Badge'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert'
import { User, Shield, CreditCard, CheckCircle, AlertTriangle, Eye, Loader2 } from 'lucide-react'

// Required documents for all users
const REQUIRED_DOCS = [
  { key: 'cnic_front', label: 'CNIC Front', required: true, hint: 'Clear photo of CNIC front side' },
  { key: 'cnic_back', label: 'CNIC Back', required: true, hint: 'Clear photo of CNIC back side' },
  { key: 'selfie', label: 'Selfie with CNIC', required: true, hint: 'Hold CNIC next to your face' },
  { key: 'bank_proof', label: 'Bank Statement / IBAN', required: true, hint: 'Bank statement or IBAN screenshot' },
]

// Additional documents for farmers
const FARMER_DOCS = [
  { key: 'farm_proof', label: 'Farm Ownership Proof', required: true, hint: 'Land registry, lease agreement, or utility bill' },
]

type KycDoc = {
  id: string
  document_type: string
  file_url: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes?: string
  created_at: string
}

export default function ProfileSettings() {
  const { profile, user, refreshMfaState, mfaEnrolled, isAal2, mfaFactorId, mfaLoading: authMfaLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const [kycDocs, setKycDocs] = useState<KycDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [editableFields, setEditableFields] = useState({
    full_name: profile?.full_name || '',
    cnic: '',
    bank_account: '',
    bank_name: '',
    farm_location: ''
  })
  const [mfaSetupFactorId, setMfaSetupFactorId] = useState<string | null>(null)
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null)
  const [mfaManualKey, setMfaManualKey] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaNotice, setMfaNotice] = useState<string | null>(null)
  const [mfaError, setMfaError] = useState<string | null>(null)
  const [mfaSetupLoading, setMfaSetupLoading] = useState(false)

  useEffect(() => {
    if (profile) {
      loadKycDocs()
      loadProfileMeta()
      refreshMfaState()
    }
  }, [profile, refreshMfaState])

  const loadKycDocs = async () => {
    try {
      const { data, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('user_id', profile!.id)
      
      if (error) throw error
      setKycDocs(data || [])
    } catch (err) {
      console.error('Failed to load KYC docs:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadProfileMeta = async () => {
    const { data, error } = await supabase
      .from('kyc_documents')
      .select('meta')
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() // Use maybeSingle to avoid error when no record
    
    if (!error && data?.meta) {
      setEditableFields(prev => ({
        ...prev,
        cnic: data.meta.cnic || '',
        bank_account: data.meta.bank_account || '',
        bank_name: data.meta.bank_name || '',
        farm_location: data.meta.farm_location || ''
      }))
    }
  }

  const getDocStatus = (docKey: string): 'pending' | 'approved' | 'rejected' | 'missing' => {
    const doc = kycDocs.find(d => d.document_type === docKey)
    if (!doc) return 'missing'
    return doc.status as 'pending' | 'approved' | 'rejected'
  }

  const getDocUrl = (docKey: string): string | null => {
    const doc = kycDocs.find(d => d.document_type === docKey)
    return doc?.file_url || null
  }

  const openDocument = async (rawUrl: string) => {
    try {
      let targetUrl = rawUrl
      if (rawUrl.startsWith('storage://')) {
        const stripped = rawUrl.replace('storage://', '')
        const [bucket, ...rest] = stripped.split('/')
        const filePath = rest.join('/')
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 120)
        if (error || !data?.signedUrl) throw new Error('Unable to open document')
        targetUrl = data.signedUrl
      }
      window.open(targetUrl, '_blank', 'noopener,noreferrer')
    } catch (err: any) {
      alert(err.message || 'Unable to open document')
    }
  }

  const uploadDocument = async (docKey: string, file: File) => {
    if (!profile) return
    setUploading(docKey)
    setUploadProgress({ [docKey]: 0 })
    
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${docKey}_${Date.now()}.${fileExt}`
      const filePath = `${profile.id}/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) throw uploadError

      const storedPath = `storage://kyc-documents/${filePath}`

      const existingDoc = kycDocs.find(d => d.document_type === docKey)
      
      if (existingDoc) {
        // Update existing - remove updated_at
        const { error: updateError } = await supabase
          .from('kyc_documents')
          .update({ 
            file_url: storedPath, 
            status: 'pending'
          })
          .eq('id', existingDoc.id)
        
        if (updateError) throw updateError
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('kyc_documents')
          .insert({
            user_id: profile.id,
            document_type: docKey,
            file_url: storedPath,
            status: 'pending'
          })
        
        if (insertError) throw insertError
      }

      setUploadProgress({ [docKey]: 100 })
      await loadKycDocs()
      alert(`✅ ${docKey.replace('_', ' ')} uploaded successfully! Awaiting admin review.`)
      
    } catch (err: any) {
      console.error('Upload failed:', err)
      alert(`❌ Upload failed: ${err.message}`)
    } finally {
      setUploading(null)
      setUploadProgress({})
    }
  }

  const saveMetaInfo = async () => {
    try {
      const metaData = {
        cnic: editableFields.cnic,
        bank_account: editableFields.bank_account,
        bank_name: editableFields.bank_name,
        farm_location: editableFields.farm_location
      }

      const existingMeta = kycDocs.find(d => d.document_type === 'meta')
      
      if (existingMeta) {
        await supabase
          .from('kyc_documents')
          .update({ meta: metaData })
          .eq('id', existingMeta.id)
      } else {
        await supabase
          .from('kyc_documents')
          .insert({
            user_id: profile!.id,
            document_type: 'meta',
            file_url: '',
            status: 'pending',
            meta: metaData
          })
      }
      alert('✅ Details saved successfully!')
    } catch (err: any) {
      alert('❌ Failed to save details: ' + err.message)
    }
  }

  const isAdmin = profile?.role === 'admin'
  const is2FAEnabled = mfaEnrolled
  const allDocsRequired = isAdmin ? [] : [...REQUIRED_DOCS, ...(profile?.role === 'farmer' ? FARMER_DOCS : [])]
  const missingDocs = allDocsRequired.filter(doc => getDocStatus(doc.key) === 'missing')
  const pendingDocs = allDocsRequired.filter(doc => getDocStatus(doc.key) === 'pending')
  const rejectedDocs = allDocsRequired.filter(doc => getDocStatus(doc.key) === 'rejected')
  const isKycComplete = isAdmin || (missingDocs.length === 0 && pendingDocs.length === 0 && rejectedDocs.length === 0)

  const parseTotpSecret = (uri: string | null) => {
    if (!uri) return null
    try {
      const parsed = new URL(uri)
      return parsed.searchParams.get('secret')
    } catch {
      return null
    }
  }

  const startGoogleAuthenticatorSetup = async () => {
    setMfaSetupLoading(true)
    setMfaError(null)
    setMfaNotice(null)

    try {
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
      if (factorsError) throw factorsError

      const activeFactor = factorsData.totp.find((factor) => factor.status === 'verified')
      if (activeFactor) {
        setMfaNotice('Google Authenticator is already active on your account.')
        await refreshMfaState()
        return
      }

      for (const factor of factorsData.totp) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id })
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Google Authenticator'
      })
      if (error || !data) throw error || new Error('Unable to generate QR code.')

      setMfaSetupFactorId(data.id)
      setMfaQrCode(data.totp.qr_code)
      setMfaManualKey(data.totp.secret || parseTotpSecret(data.totp.uri))
      setMfaNotice('QR code generated. Scan it in Google Authenticator, then enter the 6-digit code.')
    } catch (err: any) {
      setMfaError(err.message || 'Unable to start authenticator setup.')
    } finally {
      setMfaSetupLoading(false)
    }
  }

  const verifyGoogleAuthenticatorSetup = async () => {
    const factorId = mfaSetupFactorId || mfaFactorId
    if (!factorId) {
      setMfaError('No authenticator setup was found. Please generate QR again.')
      return
    }
    if (!/^\d{6}$/.test(mfaCode.trim())) {
      setMfaError('Enter a valid 6-digit code.')
      return
    }

    setMfaSetupLoading(true)
    setMfaError(null)
    setMfaNotice(null)

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError || !challengeData) throw challengeError || new Error('Challenge failed.')

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: mfaCode.trim()
      })
      if (verifyError) throw verifyError

      await refreshMfaState()
      setMfaCode('')
      setMfaSetupFactorId(null)
      setMfaQrCode(null)
      setMfaManualKey(null)
      setMfaNotice('Google Authenticator 2FA is now enabled.')
    } catch (err: any) {
      setMfaError(err.message || 'Code verification failed.')
    } finally {
      setMfaSetupLoading(false)
    }
  }

  if (loading || !profile) return <div className="p-12 text-center">Loading profile...</div>

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-stone-900 mb-8">Account Settings</h1>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <Card className="premium-shell border-0 sticky top-24">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-2xl font-bold text-green-700">
                {profile.phone?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold">{editableFields.full_name || user?.email?.split('@')[0]}</h2>
                <p className="text-stone-600 capitalize">{profile.role}</p>
                <Badge className={`mt-2 ${profile.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {profile.status === 'approved' ? 'Active' : profile.status}
                </Badge>
              </div>
              <div className="pt-4 border-t border-stone-100 space-y-2 text-sm text-left">
                <p className="flex items-center gap-2 text-stone-600"><User className="h-4 w-4" /> {user?.email}</p>
                <p className="flex items-center gap-2 text-stone-600"><CreditCard className="h-4 w-4" /> {profile.phone || 'Not added'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* KYC Status Alert */}
          {!isAdmin && !isKycComplete && (
            <Alert variant="default" className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">KYC Incomplete</AlertTitle>
              <AlertDescription className="text-yellow-700 text-sm mt-1">
                {missingDocs.length > 0 && `Missing: ${missingDocs.map(d => d.label).join(', ')}. `}
                {pendingDocs.length > 0 && `Pending review: ${pendingDocs.map(d => d.label).join(', ')}. `}
                {rejectedDocs.length > 0 && `Rejected: ${rejectedDocs.map(d => d.label).join(', ')}. Please re-upload.`}
                <br />
                {profile.role === 'farmer'
                  ? 'You cannot list livestock for investment until KYC is approved.'
                  : 'You cannot invest until KYC is approved.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Personal Info */}
          <Card className="premium-shell border-0">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><User className="h-5 w-5 text-green-600" /> Personal Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={editableFields.full_name}
                    onChange={e => setEditableFields(prev => ({ ...prev, full_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CNIC Number</Label>
                  <Input
                    value={editableFields.cnic}
                    onChange={e => setEditableFields(prev => ({ ...prev, cnic: e.target.value }))}
                    placeholder="35202-1234567-1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bank Account / IBAN</Label>
                  <Input
                    value={editableFields.bank_account}
                    onChange={e => setEditableFields(prev => ({ ...prev, bank_account: e.target.value }))}
                    placeholder="PK36SCBL0000001123456702"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input
                    value={editableFields.bank_name}
                    onChange={e => setEditableFields(prev => ({ ...prev, bank_name: e.target.value }))}
                    placeholder="HBL, UBL, MCB"
                  />
                </div>
                {profile.role === 'farmer' && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Farm Location</Label>
                    <Input
                      value={editableFields.farm_location}
                      onChange={e => setEditableFields(prev => ({ ...prev, farm_location: e.target.value }))}
                      placeholder="Village, Tehsil, District"
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={saveMetaInfo} className="bg-green-600 hover:bg-green-700">Save Details</Button>
              </div>
            </CardContent>
          </Card>

          {false && isAdmin && (
            <Card className={`premium-shell border-0 ${searchParams.get('setup') === '2fa' ? 'ring-2 ring-green-500' : ''}`}>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Shield className="h-5 w-5 text-green-600" /> Google Authenticator 2FA</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-stone-50">
                    <span className="text-sm text-stone-700">Current Status</span>
                    {is2FAEnabled ? (
                      <Badge variant="success" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Enabled</Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-700">Setup Required</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={startGoogleAuthenticatorSetup} disabled={mfaSetupLoading || authMfaLoading} className="bg-green-600 hover:bg-green-700">
                      {mfaSetupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (is2FAEnabled ? 'Regenerate QR' : 'Generate QR')}
                    </Button>
                    {is2FAEnabled && !isAal2 && (
                      <Button onClick={verifyGoogleAuthenticatorSetup} disabled={mfaSetupLoading || mfaCode.trim().length !== 6} variant="outline">
                        Verify Session
                      </Button>
                    )}
                  </div>
                  {mfaQrCode && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                      <p className="text-sm text-emerald-900">Scan this QR in Google Authenticator:</p>
                      {(mfaQrCode || '').startsWith('<svg') ? (
                        <div className="mx-auto w-fit bg-white p-2 rounded-md" dangerouslySetInnerHTML={{ __html: mfaQrCode || '' }} />
                      ) : (
                        <img src={mfaQrCode || ''} alt="Authenticator QR" className="w-48 h-48 mx-auto bg-white p-2 rounded-md" />
                      )}
                      {mfaManualKey && (
                        <div className="rounded-md bg-white border border-emerald-200 p-3">
                          <p className="text-xs text-emerald-900 mb-1">If scanning is difficult on mobile, use manual key:</p>
                          <p className="text-xs text-emerald-900 break-all font-semibold">{mfaManualKey}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {(mfaSetupFactorId || (is2FAEnabled && !isAal2)) && (
                    <div className="grid sm:grid-cols-3 gap-2">
                      <Input
                        className="sm:col-span-2"
                        placeholder="Enter 6-digit code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      />
                      <Button onClick={verifyGoogleAuthenticatorSetup} disabled={mfaSetupLoading || mfaCode.trim().length !== 6} variant="outline">
                        Verify Code
                      </Button>
                    </div>
                  )}
                  {mfaNotice && <p className="text-xs text-emerald-700">{mfaNotice}</p>}
                  {mfaError && <p className="text-xs text-red-600">{mfaError}</p>}
                  <p className="text-xs text-stone-500">
                    2FA is required for admin dashboard access.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {!isAdmin ? (
            <>
              {/* Document Uploads */}
              <Card className="premium-shell border-0">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Shield className="h-5 w-5 text-green-600" />
                    <h3 className="text-xl font-bold">KYC Documents</h3>
                  </div>
                  <div className="space-y-6">
                    {allDocsRequired.map(doc => {
                      const status = getDocStatus(doc.key)
                      const fileUrl = getDocUrl(doc.key)
                      const isUploading = uploading === doc.key
                      return (
                        <div key={doc.key} className="border rounded-lg p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <p className="font-medium">{doc.label} {doc.required && <span className="text-red-500">*</span>}</p>
                              <p className="text-xs text-stone-500">{doc.hint}</p>
                              {status === 'rejected' && (
                                <p className="text-xs text-red-600 mt-1">Rejected: {kycDocs.find(d => d.document_type === doc.key)?.admin_notes || 'Please re-upload'}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {status === 'approved' && (
                                <Badge variant="success" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Approved</Badge>
                              )}
                              {status === 'pending' && (
                                <Badge className="bg-yellow-100 text-yellow-700 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Pending</Badge>
                              )}
                              {status === 'missing' && (
                                <Badge variant="outline" className="text-red-600 border-red-200">Not uploaded</Badge>
                              )}
                          {fileUrl && (
                            <button
                              type="button"
                              onClick={() => openDocument(fileUrl)}
                              className="text-xs text-green-600 hover:underline flex items-center gap-1"
                            >
                              <Eye className="h-3 w-3" /> View
                            </button>
                          )}
                              <label className={`cursor-pointer px-3 py-1 rounded-md text-sm ${status === 'approved' ? 'bg-stone-100 text-stone-500' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                                {isUploading ? `${uploadProgress[doc.key] || 0}%` : (fileUrl ? 'Replace' : 'Upload')}
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  className="hidden"
                                  disabled={isUploading}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (file) await uploadDocument(doc.key, file)
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Verification Summary */}
              <Card className="premium-shell border-0">
                <CardContent className="p-6">
                  <h3 className="font-bold mb-4">Verification Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                      <span>KYC Status</span>
                      {isKycComplete ? (
                        <Badge variant="success" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Complete</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-700">Incomplete</Badge>
                      )}
                    </div>
                    <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                      <span>Account Status</span>
                      <Badge className={profile.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                        {profile.status === 'approved' ? 'Active' : profile.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="premium-shell border-0 bg-blue-50">
              <CardContent className="p-6">
                <h3 className="font-bold text-stone-900 mb-2">Admin Account Policy</h3>
                <p className="text-sm text-stone-700">
                  Admin accounts do not require KYC document verification. Admin verification is managed through internal role assignment and access controls.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
