import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/Dialog'
import { formatCurrency, formatDate } from '../../lib/utils'
import { Activity, AlertTriangle, CheckCircle, Loader2, MapPin, Shield, Stethoscope, UserPlus } from 'lucide-react'
import PakistanLocationSelect from '../../components/location/PakistanLocationSelect'

type DoctorForm = {
  full_name: string
  phone: string
  city: string
  area: string
  license_no: string
  clinic_name: string
  fee_per_animal: string
}

type ReportForm = {
  assignmentId: string
  livestockId: string
  doctorId: string
  status: 'approved' | 'rejected'
  health_status: string
  weight_kg: string
  temperature_f: string
  heart_rate_bpm: string
  vet_notes: string
  premium_amount: string
}

const initialDoctorForm: DoctorForm = {
  full_name: '',
  phone: '',
  city: 'Karachi',
  area: '',
  license_no: '',
  clinic_name: '',
  fee_per_animal: '5000',
}

export default function AdminMedicalOps() {
  const [doctors, setDoctors] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [doctorForm, setDoctorForm] = useState<DoctorForm>(initialDoctorForm)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportForm, setReportForm] = useState<ReportForm | null>(null)
  const [schemaError, setSchemaError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setSchemaError(null)
    try {
      const [doctorRes, assignmentRes] = await Promise.all([
        supabase.from('veterinary_partners').select('*').order('created_at', { ascending: false }),
        supabase
          .from('medical_assignments')
          .select('*, doctor:veterinary_partners(*), livestock:livestock(*, farmer:profiles(full_name, phone, status))')
          .order('created_at', { ascending: false }),
      ])

      const schemaMessage = doctorRes.error?.message || assignmentRes.error?.message || ''
      if (schemaMessage.includes('schema cache') || schemaMessage.includes('does not exist')) {
        setSchemaError('Medical & insurance database tables are not installed yet. Please apply migration 0004_medical_insurance_risk_flow.sql in Supabase, then refresh this page.')
        setDoctors([])
        setAssignments([])
        return
      }

      if (doctorRes.error) throw doctorRes.error
      if (assignmentRes.error) throw assignmentRes.error

      const driftedCleared = (assignmentRes.data || []).filter((a: any) => a.status === 'cleared' && a.livestock?.status !== 'active')
      const driftedRejected = (assignmentRes.data || []).filter((a: any) => a.status === 'rejected' && a.livestock?.status !== 'rejected')
      await Promise.all([
        ...driftedCleared.map((a: any) => supabase.from('livestock').update({ status: 'active' }).eq('id', a.livestock_id)),
        ...driftedRejected.map((a: any) => supabase.from('livestock').update({ status: 'rejected' }).eq('id', a.livestock_id)),
      ])

      setDoctors(doctorRes.data || [])
      if (driftedCleared.length || driftedRejected.length) {
        const { data: refreshed } = await supabase
          .from('medical_assignments')
          .select('*, doctor:veterinary_partners(*), livestock:livestock(*, farmer:profiles(full_name, phone, status))')
          .order('created_at', { ascending: false })
        setAssignments(refreshed || assignmentRes.data || [])
      } else {
        setAssignments(assignmentRes.data || [])
      }
    } catch (err: any) {
      setSchemaError(err.message || 'Unable to load medical operations data.')
    } finally {
      setLoading(false)
    }
  }

  const metrics = useMemo(() => ({
    doctors: doctors.filter((d) => d.status === 'active').length,
    pendingDoctors: doctors.filter((d) => d.status === 'pending').length,
    pending: assignments.filter((a) => ['pending', 'unassigned', 'in_progress'].includes(a.status)).length,
    cleared: assignments.filter((a) => a.status === 'cleared').length,
    rejected: assignments.filter((a) => a.status === 'rejected').length,
  }), [doctors, assignments])

  const onboardDoctor = async () => {
    if (!doctorForm.full_name || !doctorForm.phone || !doctorForm.city) {
      alert('Doctor name, phone and city are required')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('veterinary_partners').insert({
        full_name: doctorForm.full_name,
        phone: doctorForm.phone,
        city: doctorForm.city,
        area: doctorForm.area || null,
        license_no: doctorForm.license_no || null,
        clinic_name: doctorForm.clinic_name || null,
        fee_per_animal: Number(doctorForm.fee_per_animal || 0),
        status: 'active',
      })
      if (error?.message?.includes("'area' column")) {
        const { error: fallbackError } = await supabase.from('veterinary_partners').insert({
          full_name: doctorForm.full_name,
          phone: doctorForm.phone,
          city: doctorForm.city,
          license_no: doctorForm.license_no || null,
          clinic_name: doctorForm.clinic_name || null,
          fee_per_animal: Number(doctorForm.fee_per_animal || 0),
          status: 'active',
        })
        if (fallbackError) throw fallbackError
      } else if (error) throw error
      setDoctorForm(initialDoctorForm)
      await loadData()
    } catch (err: any) {
      const message = err.message || 'Failed to onboard doctor'
      if (message.includes('schema cache') || message.includes('does not exist')) {
        setSchemaError('Doctor table is missing. Apply migration 0004_medical_insurance_risk_flow.sql before onboarding doctors.')
      } else {
        setSchemaError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  const setDoctorStatus = async (doctorId: string, status: 'active' | 'inactive' | 'suspended') => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('veterinary_partners')
        .update({ status })
        .eq('id', doctorId)
      if (error) throw error
      await loadData()
    } catch (err: any) {
      setSchemaError(err.message || 'Unable to update doctor status.')
    } finally {
      setSaving(false)
    }
  }

  const assignDoctor = async (assignmentId: string, doctorId: string) => {
    const doctor = doctors.find((d) => d.id === doctorId)
      const { error } = await supabase
      .from('medical_assignments')
      .update({
        doctor_id: doctorId,
        fee_amount: doctor?.fee_per_animal || 0,
        status: 'pending',
      })
      .eq('id', assignmentId)
    if (error) setSchemaError(error.message)
    await loadData()
  }

  const openReport = (assignment: any, status: 'approved' | 'rejected') => {
    setReportForm({
      assignmentId: assignment.id,
      livestockId: assignment.livestock_id,
      doctorId: assignment.doctor_id || '',
      status,
      health_status: status === 'approved' ? 'good' : 'rejected',
      weight_kg: assignment.livestock?.weight_kg?.toString() || '',
      temperature_f: '101.5',
      heart_rate_bpm: '60',
      vet_notes: '',
      premium_amount: assignment.livestock?.insurance_enabled
        ? Math.round(Number(assignment.livestock?.cost_price || 0) * 0.025).toString()
        : '0',
    })
    setReportOpen(true)
  }

  const submitReport = async () => {
    if (!reportForm) return
    if (!reportForm.doctorId) {
      alert('Assign doctor before submitting report')
      return
    }
    if (!reportForm.vet_notes.trim()) {
      alert('Report notes are required')
      return
    }

    setSaving(true)
    try {
      const isApproved = reportForm.status === 'approved'
      const assignment = assignments.find((a) => a.id === reportForm.assignmentId)
      const livestock = assignment?.livestock

      const { error: reportError } = await supabase.from('vet_reports').insert({
        livestock_id: reportForm.livestockId,
        assignment_id: reportForm.assignmentId,
        vet_id: reportForm.doctorId,
        weight_kg: Number(reportForm.weight_kg || 0) || null,
        temperature_f: Number(reportForm.temperature_f || 0) || null,
        heart_rate_bpm: Number(reportForm.heart_rate_bpm || 0) || null,
        health_status: reportForm.health_status,
        vet_notes: reportForm.vet_notes,
        fit_for_investment: isApproved,
        status: isApproved ? 'approved' : 'rejected',
        inspection_date: new Date().toISOString(),
      })
      if (reportError) throw reportError

      await supabase
        .from('medical_assignments')
        .update({
          status: isApproved ? 'cleared' : 'rejected',
          completed_at: new Date().toISOString(),
        })
        .eq('id', reportForm.assignmentId)

      await supabase
        .from('livestock')
        .update({ status: isApproved ? 'active' : 'rejected' })
        .eq('id', reportForm.livestockId)

      if (livestock?.farmer_id) {
        await supabase.from('notifications').insert({
          user_id: livestock.farmer_id,
          type: isApproved ? 'medical_cleared' : 'medical_rejected',
          title: isApproved ? 'Livestock medically cleared' : 'Livestock medical review rejected',
          message: isApproved
            ? `${livestock.title || 'Your livestock'} is now active for investors.`
            : `${livestock.title || 'Your livestock'} was rejected after medical review.`,
          metadata: { livestock_id: reportForm.livestockId, assignment_id: reportForm.assignmentId },
        }).then(() => null)
      }

      if (isApproved && livestock?.insurance_enabled) {
        await supabase.from('insurance_policies').insert({
          livestock_id: reportForm.livestockId,
          provider_name: 'MaweshiHub Risk Pool',
          coverage_amount: Number(livestock.cost_price || 0),
          premium_amount: Number(reportForm.premium_amount || 0),
          covered_risks: ['death', 'disease', 'theft'],
          status: 'active',
        })
      }

      if (!isApproved) {
        await supabase.from('fraud_flags').insert({
          livestock_id: reportForm.livestockId,
          flag_type: 'medical_rejection',
          severity: 2,
          description: `Medical rejection: ${reportForm.vet_notes}`,
          status: 'pending',
        })
      }

      setReportOpen(false)
      setReportForm(null)
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to submit report')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Medical & Insurance Control</h1>
              <p className="text-sm text-stone-600">Taxi-style doctor dispatch: nearby doctors receive open tasks and first accepted doctor owns the inspection.</p>
            </div>
            <div className="flex gap-2">
              <Link to="/doctor/onboard"><Button variant="outline">Doctor Signup</Button></Link>
              <Link to="/doctor/tasks"><Button className="bg-emerald-600 hover:bg-emerald-700">Task Board</Button></Link>
            </div>
          </div>
        </div>

        {schemaError && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <AlertTitle className="text-amber-900">Database setup required</AlertTitle>
            <AlertDescription className="text-sm text-amber-800">
              {schemaError}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid sm:grid-cols-4 gap-4">
          <Metric label="Active Doctors" value={metrics.doctors} icon={<Stethoscope className="h-5 w-5 text-emerald-700" />} />
          <Metric label="Pending Doctors" value={metrics.pendingDoctors} icon={<UserPlus className="h-5 w-5 text-amber-700" />} />
          <Metric label="Pending Reviews" value={metrics.pending} icon={<Activity className="h-5 w-5 text-blue-700" />} />
          <Metric label="Cleared" value={metrics.cleared} icon={<CheckCircle className="h-5 w-5 text-green-700" />} />
        </div>

        <Card className="premium-shell border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-emerald-700" /> Admin Quick Onboard</CardTitle>
            <CardDescription>Doctors can also self-register from Doctor Network. Admin verifies and activates them.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-6 gap-3">
            <Input placeholder="Doctor name" value={doctorForm.full_name} onChange={(e) => setDoctorForm((p) => ({ ...p, full_name: e.target.value }))} />
            <Input placeholder="Phone" value={doctorForm.phone} onChange={(e) => setDoctorForm((p) => ({ ...p, phone: e.target.value }))} />
            <Input placeholder="License no" value={doctorForm.license_no} onChange={(e) => setDoctorForm((p) => ({ ...p, license_no: e.target.value }))} />
            <Input placeholder="Fee per animal" type="number" value={doctorForm.fee_per_animal} onChange={(e) => setDoctorForm((p) => ({ ...p, fee_per_animal: e.target.value }))} />
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={onboardDoctor} disabled={saving || Boolean(schemaError)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Doctor'}
            </Button>
            <div className="md:col-span-6">
              <PakistanLocationSelect
                city={doctorForm.city}
                area={doctorForm.area}
                onCityChange={(value) => setDoctorForm((p) => ({ ...p, city: value }))}
                onAreaChange={(value) => setDoctorForm((p) => ({ ...p, area: value }))}
                cityLabel="Doctor city/village"
                areaLabel="Doctor area"
              />
            </div>
            <Input className="md:col-span-6" placeholder="Clinic name" value={doctorForm.clinic_name} onChange={(e) => setDoctorForm((p) => ({ ...p, clinic_name: e.target.value }))} />
          </CardContent>
        </Card>

        <Card className="premium-shell border-0">
          <CardHeader>
            <CardTitle>Doctor Directory</CardTitle>
            <CardDescription>Verified doctors receive nearby task notifications. Pending doctors need admin approval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {doctors.length === 0 ? (
              <p className="text-sm text-stone-500 text-center py-8">No doctors onboarded yet.</p>
            ) : (
              doctors.map((doctor) => (
                <div key={doctor.id} className="rounded-lg border border-stone-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-stone-900">{doctor.full_name}</p>
                        <Badge className={doctor.status === 'active' ? 'bg-green-100 text-green-700' : doctor.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-stone-100 text-stone-700'}>{doctor.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        <MapPin className="mr-1 inline h-3.5 w-3.5" /> {doctor.city}{doctor.area ? `, ${doctor.area}` : ''} • {doctor.phone} • License: {doctor.license_no || 'N/A'}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {doctor.clinic_name || 'No clinic'}{doctor.experience_years ? ` • ${doctor.experience_years} years exp.` : ''}{doctor.qualification ? ` • ${doctor.qualification}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {doctor.status !== 'active' && (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setDoctorStatus(doctor.id, 'active')} disabled={saving}>Approve</Button>
                      )}
                      {doctor.status === 'active' && (
                        <Button size="sm" variant="outline" onClick={() => setDoctorStatus(doctor.id, 'inactive')} disabled={saving}>Pause</Button>
                      )}
                      {doctor.status !== 'suspended' && (
                        <Button size="sm" variant="outline" className="border-red-300 text-red-600" onClick={() => setDoctorStatus(doctor.id, 'suspended')} disabled={saving}>Suspend</Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="premium-shell border-0">
          <CardHeader>
            <CardTitle>Medical Assignments</CardTitle>
            <CardDescription>Projects become investor-visible only after doctor clearance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {assignments.length === 0 ? (
              <p className="text-sm text-stone-500 text-center py-8">No medical assignments yet.</p>
            ) : (
              assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-lg border border-stone-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-stone-900">{assignment.livestock?.title || 'Livestock'}</p>
                        <Badge className={assignment.status === 'cleared' ? 'bg-green-100 text-green-700' : assignment.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}>
                          {assignment.status}
                        </Badge>
                        {assignment.livestock?.insurance_enabled && <Badge variant="outline"><Shield className="h-3 w-3 mr-1" /> Insurance requested</Badge>}
                      </div>
                      <p className="text-xs text-stone-500">
                        {assignment.city} • Farmer: {assignment.livestock?.farmer?.full_name || 'Unknown'} • Due {formatDate(assignment.due_at)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        value={assignment.doctor_id || ''}
                        onChange={(e) => assignDoctor(assignment.id, e.target.value)}
                        className="h-10 min-w-48 rounded-md border border-stone-300 bg-white px-3 text-sm"
                        disabled={assignment.status === 'cleared' || assignment.status === 'rejected'}
                      >
                        <option value="">Assign doctor</option>
                        {doctors.filter((d) => d.status === 'active').map((doctor) => (
                          <option key={doctor.id} value={doctor.id}>
                            {doctor.full_name} ({doctor.city})
                          </option>
                        ))}
                      </select>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openReport(assignment, 'approved')} disabled={!assignment.doctor_id || assignment.status === 'cleared'}>
                        Clear
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-300" onClick={() => openReport(assignment, 'rejected')} disabled={!assignment.doctor_id || assignment.status === 'rejected'}>
                        Reject
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid sm:grid-cols-4 gap-3 text-xs text-stone-600">
                    <span>Doctor: {assignment.doctor?.full_name || 'Not assigned'}</span>
                    <span>Fee: {formatCurrency(Number(assignment.fee_amount || 0))}</span>
                    <span>Weight: {assignment.livestock?.weight_kg || '-'}kg</span>
                    <span>Cost: {formatCurrency(Number(assignment.livestock?.cost_price || 0))}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{reportForm?.status === 'approved' ? 'Submit Clearance Report' : 'Submit Rejection Report'}</DialogTitle>
            <DialogDescription>Doctor report becomes part of project risk record.</DialogDescription>
          </DialogHeader>

          {reportForm && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Input placeholder="Health status" value={reportForm.health_status} onChange={(e) => setReportForm((p) => p && ({ ...p, health_status: e.target.value }))} />
              <Input placeholder="Weight kg" type="number" value={reportForm.weight_kg} onChange={(e) => setReportForm((p) => p && ({ ...p, weight_kg: e.target.value }))} />
              <Input placeholder="Temperature F" type="number" value={reportForm.temperature_f} onChange={(e) => setReportForm((p) => p && ({ ...p, temperature_f: e.target.value }))} />
              <Input placeholder="Heart rate BPM" type="number" value={reportForm.heart_rate_bpm} onChange={(e) => setReportForm((p) => p && ({ ...p, heart_rate_bpm: e.target.value }))} />
              {reportForm.status === 'approved' && (
                <Input placeholder="Insurance premium" type="number" value={reportForm.premium_amount} onChange={(e) => setReportForm((p) => p && ({ ...p, premium_amount: e.target.value }))} />
              )}
              <textarea
                className="sm:col-span-2 min-h-28 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                placeholder="Detailed report, findings, risks, and recommendation"
                value={reportForm.vet_notes}
                onChange={(e) => setReportForm((p) => p && ({ ...p, vet_notes: e.target.value }))}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button className={reportForm?.status === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} onClick={submitReport} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="premium-shell border-0">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-600">{label}</p>
            <p className="text-2xl font-bold text-stone-900">{value}</p>
          </div>
          <div className="h-11 w-11 rounded-lg bg-stone-100 flex items-center justify-center">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}
