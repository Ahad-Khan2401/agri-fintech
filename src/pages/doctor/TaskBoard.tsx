import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert'
import { formatCurrency, formatDate } from '../../lib/utils'
import { AlertTriangle, CheckCircle, Loader2, MapPin, Radio, Stethoscope } from 'lucide-react'

export default function DoctorTaskBoard() {
  const [phone, setPhone] = useState('')
  const [doctor, setDoctor] = useState<any | null>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const matchingAssignments = useMemo(() => {
    if (!doctor) return []
    return assignments.filter((assignment) => {
      const cityMatch = (assignment.city || '').toLowerCase() === (doctor.city || '').toLowerCase()
      const area = (doctor.area || '').toLowerCase()
      const assignmentArea = (assignment.area || assignment.livestock?.area || '').toLowerCase()
      return cityMatch && (!area || !assignmentArea || assignmentArea.includes(area) || area.includes(assignmentArea))
    })
  }, [assignments, doctor])

  useEffect(() => {
    if (doctor) loadAssignments()
  }, [doctor])

  const findDoctor = async () => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const { data, error: doctorError } = await supabase
        .from('veterinary_partners')
        .select('*')
        .eq('phone', phone.trim())
        .in('status', ['active', 'approved'])
        .maybeSingle()

      if (doctorError) throw doctorError
      if (!data) {
        setDoctor(null)
        setError('No active doctor found with this phone. Please complete onboarding or wait for admin approval.')
        return
      }
      setDoctor(data)
    } catch (err: any) {
      setError(err.message || 'Unable to find doctor profile.')
    } finally {
      setLoading(false)
    }
  }

  const loadAssignments = async () => {
    setLoading(true)
    try {
      const { data, error: assignmentError } = await supabase
        .from('medical_assignments')
        .select('*, livestock:livestock(title, breed, weight_kg, cost_price, location_city, insurance_enabled)')
        .in('status', ['unassigned', 'pending'])
        .is('doctor_id', null)
        .order('created_at', { ascending: false })

      if (assignmentError) throw assignmentError
      setAssignments(data || [])
    } catch (err: any) {
      setError(err.message || 'Unable to load tasks.')
    } finally {
      setLoading(false)
    }
  }

  const acceptTask = async (assignmentId: string) => {
    if (!doctor) return
    setAcceptingId(assignmentId)
    setError(null)
    setNotice(null)
    try {
      const { data, error: claimError } = await supabase
        .from('medical_assignments')
        .update({
          doctor_id: doctor.id,
          fee_amount: doctor.fee_per_animal || 0,
          status: 'pending',
          assigned_at: new Date().toISOString(),
        })
        .eq('id', assignmentId)
        .is('doctor_id', null)
        .in('status', ['unassigned', 'pending'])
        .select('id')
        .maybeSingle()

      if (claimError) throw claimError
      if (!data) {
        setNotice('This task was already accepted by another doctor.')
      } else {
        setNotice('Task accepted. Admin can now see this assignment under your name.')
      }
      await loadAssignments()
    } catch (err: any) {
      setError(err.message || 'Unable to accept task.')
    } finally {
      setAcceptingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_5%,rgba(212,174,92,0.18),transparent_28%),linear-gradient(135deg,#fbf8ef_0%,#ecf3ef_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-lg bg-[#14261f] p-8 text-white shadow-[0_32px_90px_-42px_rgba(20,38,31,0.9)]">
          <Badge className="mb-4 bg-amber-300/15 text-amber-100 border border-amber-200/20">Live Medical Requests</Badge>
          <h1 className="font-serif text-4xl font-bold">Doctor Task Board</h1>
          <p className="mt-3 max-w-2xl text-sm text-emerald-50/75">Enter your registered phone number to view nearby inspection requests. First accepted doctor gets the task.</p>
        </div>

        <Card className="premium-shell border-0 mb-6">
          <CardContent className="grid gap-3 p-5 sm:grid-cols-[1fr_auto]">
            <Input placeholder="Registered doctor phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={findDoctor} disabled={loading || !phone.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find My Tasks'}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-700" />
            <AlertTitle className="text-red-900">Unable to continue</AlertTitle>
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {notice && (
          <Alert className="mb-6 border-emerald-200 bg-emerald-50">
            <CheckCircle className="h-4 w-4 text-emerald-700" />
            <AlertTitle className="text-emerald-900">Task update</AlertTitle>
            <AlertDescription className="text-emerald-800">{notice}</AlertDescription>
          </Alert>
        )}

        {doctor && (
          <Card className="premium-shell border-0 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5 text-emerald-700" /> {doctor.full_name}</CardTitle>
              <CardDescription>{doctor.city}{doctor.area ? `, ${doctor.area}` : ''} • {doctor.clinic_name || 'Independent doctor'}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="grid gap-4">
          {doctor && matchingAssignments.length === 0 && (
            <Card className="premium-shell border-0">
              <CardContent className="py-12 text-center text-stone-500">No nearby open tasks right now.</CardContent>
            </Card>
          )}

          {matchingAssignments.map((assignment) => (
            <Card key={assignment.id} className="premium-shell border-0">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-stone-900">{assignment.livestock?.title || 'Livestock inspection'}</h3>
                      <Badge className="bg-yellow-100 text-yellow-800"><Radio className="mr-1 h-3 w-3" /> Open request</Badge>
                      {assignment.livestock?.insurance_enabled && <Badge variant="outline">Insurance requested</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-stone-600">
                      {assignment.livestock?.breed || 'Animal'} • {assignment.livestock?.weight_kg || '-'}kg • {formatCurrency(Number(assignment.livestock?.cost_price || 0))}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-stone-500">
                      <MapPin className="h-3.5 w-3.5" /> {assignment.city}{assignment.area ? `, ${assignment.area}` : ''} • Due {formatDate(assignment.due_at)}
                    </p>
                  </div>
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => acceptTask(assignment.id)} disabled={acceptingId === assignment.id}>
                    {acceptingId === assignment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept Task'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
