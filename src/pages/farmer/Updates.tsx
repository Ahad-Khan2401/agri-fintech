import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { ArrowLeft, Upload, CheckCircle, AlertCircle, X, Image as ImageIcon, Video, Loader2 } from 'lucide-react'

export default function Updates() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [weight, setWeight] = useState('')
  const [health, setHealth] = useState('healthy')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      alert('File size must be less than 50MB')
      return
    }
    setPreviewFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  const removePreview = () => {
    setPreviewFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadMedia = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `update_${Date.now()}.${fileExt}`
    const filePath = `${profile!.id}/updates/${fileName}`
    
    const { error } = await supabase.storage
      .from('livestock-media')
      .upload(filePath, file, { cacheControl: '3600' })
    
    if (error) throw error
    
    const { data: urlData } = supabase.storage
      .from('livestock-media')
      .getPublicUrl(filePath)
    
    return urlData.publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !id) return
    if (!previewFile) {
      alert('Please upload a photo or video proof')
      return
    }
    
    setSubmitting(true)
    setUploadProgress(0)
    
    try {
      // Simulate progress
      const interval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)
      
      const mediaUrl = await uploadMedia(previewFile)
      
      clearInterval(interval)
      setUploadProgress(100)
      
      await supabase.from('livestock_updates').insert([{
        livestock_id: id,
        farmer_id: profile.id,
        weight_kg: weight ? parseFloat(weight) : null,
        health_status: health,
        notes: notes || null,
        media_url: mediaUrl
      }])
      
      alert('✅ Update posted successfully! Investors will be notified.')
      navigate(-1)
    } catch (err: any) {
      console.error('Update error:', err)
      alert('❌ Failed to post update: ' + err.message)
    } finally {
      setSubmitting(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-stone-600">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Post Weekly Update</h1>
            <p className="text-stone-600">Keep investors informed about your animal's progress</p>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Update Details</CardTitle>
            <CardDescription>Regular updates build trust and prevent fraud flags</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              
              <div className="space-y-2">
                <Label>Current Weight (KG)</Label>
                <Input 
                  type="number" 
                  step="0.1" 
                  value={weight} 
                  onChange={e => setWeight(e.target.value)} 
                  placeholder="e.g., 245.5"
                  className="max-w-xs"
                />
              </div>

              <div className="space-y-2">
                <Label>Health Status *</Label>
                <Select value={health} onValueChange={setHealth}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="healthy">✅ Healthy & Active</SelectItem>
                    <SelectItem value="minor_issue">⚠️ Minor Issue (Monitoring)</SelectItem>
                    <SelectItem value="treatment">🏥 Under Treatment</SelectItem>
                    <SelectItem value="critical">🚨 Critical Condition</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes / Observations</Label>
                <Input 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Feed changes, behavior, vaccination, weather impact, etc."
                />
              </div>

              <div className="space-y-2">
                <Label>Photo / Video Proof *</Label>
                {!previewUrl ? (
                  <div 
                    className="border-2 border-dashed border-stone-300 rounded-lg p-8 text-center hover:border-green-500 cursor-pointer transition bg-stone-50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Upload className="h-8 w-8 text-stone-400 mx-auto mb-2" />
                    <p className="text-sm text-stone-600">Click to upload media</p>
                    <p className="text-xs text-stone-400 mt-1">Supported: JPG, PNG, MP4 (max 50MB)</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="aspect-video bg-stone-100 rounded-lg overflow-hidden">
                      {previewUrl.endsWith('.mp4') || previewUrl.endsWith('.webm') ? (
                        <video src={previewUrl} className="w-full h-full object-contain" controls />
                      ) : (
                        <img src={previewUrl} alt="Update preview" className="w-full h-full object-contain" />
                      )}
                    </div>
                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="bg-white rounded-full p-2 w-32 text-center">
                          <div className="bg-green-600 h-1 rounded-full" style={{ width: `${uploadProgress}%` }} />
                          <span className="text-xs text-white">{uploadProgress}%</span>
                        </div>
                      </div>
                    )}
                    <button 
                      type="button"
                      onClick={removePreview}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <Badge variant="secondary" className="absolute bottom-2 left-2 text-[10px]">
                      {previewUrl.endsWith('.mp4') ? <Video className="h-3 w-3 mr-1" /> : <ImageIcon className="h-3 w-3 mr-1" />}
                      Preview
                    </Badge>
                  </div>
                )}
                <Alert variant="default" className="bg-yellow-50 border-yellow-200">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800 text-sm">Media Requirements</AlertTitle>
                  <AlertDescription className="text-yellow-700 text-xs mt-1">
                    • Clear, well-lit photo/video showing the animal<br/>
                    • Video should show animal walking & eating (15-30 sec)<br/>
                    • No watermarks or edited content
                  </AlertDescription>
                </Alert>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={submitting || !previewFile}>
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="animate-spin h-4 w-4" />
                      Posting...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" /> Post Update
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>

        <Card className="border-0 shadow-sm mt-6 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-stone-900">Why Updates Matter</p>
                <ul className="text-sm text-stone-600 mt-1 space-y-1">
                  <li>• Builds investor confidence in your management</li>
                  <li>• Prevents automatic fraud flags for inactivity</li>
                  <li>• Helps track animal health trends over time</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
