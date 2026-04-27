import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/Dialog'
import { formatCurrency, formatDate } from '../../lib/utils'
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Search, Shield, Sprout, Users, Wallet, X } from 'lucide-react'

type AdminTab = 'farmers' | 'investors' | 'projects' | 'sales' | 'risk'
type KycDoc = { id: string; document_type: string; file_url: string; status: string; user_id: string; created_at?: string }
const REQUIRED_KYC_DOCS = ['cnic_front', 'cnic_back', 'selfie', 'bank_proof']

export default function AdminApprovals() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as AdminTab) || 'farmers'
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const [farmers, setFarmers] = useState<any[]>([])
  const [investors, setInvestors] = useState<any[]>([])
  const [pendingProjects, setPendingProjects] = useState<any[]>([])
  const [pendingSales, setPendingSales] = useState<any[]>([])
  const [riskFlags, setRiskFlags] = useState<any[]>([])

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<{ type: AdminTab; id: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    setSearchParams({ tab: activeTab })
  }, [activeTab, setSearchParams])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [farmerRes, investorRes, kycRes, projectRes, salesRes, flagRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'farmer').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('role', 'investor').order('created_at', { ascending: false }),
        supabase.from('kyc_documents').select('*').order('created_at', { ascending: false }),
        supabase.from('livestock').select('*').eq('status', 'draft').order('created_at', { ascending: false }),
        supabase.from('sale_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('fraud_flags').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      ])

      const attachDocs = (items: any[]) =>
        items
          .map((item) => {
            const allDocs = (kycRes.data || []).filter((doc: any) => doc.user_id === item.id && doc.document_type !== 'meta')
            const latestByType = new Map<string, any>()

            allDocs
              .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
              .forEach((doc: any) => {
                if (!latestByType.has(doc.document_type)) latestByType.set(doc.document_type, doc)
              })

            const latestDocs = Array.from(latestByType.values())
            const pendingDocs = latestDocs.filter((d: any) => d.status === 'pending')
            const missingRequired = REQUIRED_KYC_DOCS.filter((type) => !latestByType.has(type))
            return {
              ...item,
              docs: latestDocs,
              pendingDocsCount: pendingDocs.length,
              missingRequiredCount: missingRequired.length,
            }
          })
          .filter((item) => item.status === 'pending' || item.pendingDocsCount > 0 || item.missingRequiredCount > 0)

      setFarmers(attachDocs(farmerRes.data || []))
      setInvestors(attachDocs(investorRes.data || []))
      setPendingProjects(projectRes.data || [])
      setPendingSales(salesRes.data || [])
      setRiskFlags(flagRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  const filteredFarmers = useMemo(() => filterBySearch(farmers, search), [farmers, search])
  const filteredInvestors = useMemo(() => filterBySearch(investors, search), [investors, search])
  const filteredProjects = useMemo(() => pendingProjects.filter((p) => `${p.title || ''} ${p.breed || ''}`.toLowerCase().includes(search.toLowerCase())), [pendingProjects, search])
  const filteredSales = useMemo(() => pendingSales.filter((s) => `${s.id || ''} ${s.buyer_phone || ''}`.toLowerCase().includes(search.toLowerCase())), [pendingSales, search])
  const filteredFlags = useMemo(() => riskFlags.filter((f) => `${f.flag_type || ''} ${f.description || ''}`.toLowerCase().includes(search.toLowerCase())), [riskFlags, search])

  const approveUser = async (userId: string) => {
    setProcessingId(userId)
    try {
      await supabase.from('profiles').update({ status: 'approved' }).eq('id', userId)
      await supabase
        .from('kyc_documents')
        .update({ status: 'approved', notes: 'Approved by admin' })
        .eq('user_id', userId)
        .neq('document_type', 'meta')
      await loadData()
    } finally {
      setProcessingId(null)
    }
  }

  const approveProject = async (projectId: string) => {
    setProcessingId(projectId)
    try {
      const { data: project, error: projectError } = await supabase
        .from('livestock')
        .select('*')
        .eq('id', projectId)
        .single()
      if (projectError || !project) throw projectError || new Error('Project not found')

      const city = project.location?.city || project.location_city || 'Karachi'
      const area = project.area || project.location?.area || null

      await supabase.from('livestock').update({ status: 'medical_review' }).eq('id', projectId)
      const assignmentPayload = {
        livestock_id: projectId,
        farmer_id: project.farmer_id,
        doctor_id: null,
        city,
        area,
        fee_amount: 0,
        status: 'unassigned',
      }

      const firstAttempt = await supabase.from('medical_assignments').insert(assignmentPayload)
      if (firstAttempt.error?.message?.includes("'area' column")) {
        const { area: _area, ...fallbackPayload } = assignmentPayload
        const fallback = await supabase.from('medical_assignments').insert(fallbackPayload)
        if (fallback.error) throw fallback.error
      } else if (firstAttempt.error) {
        throw firstAttempt.error
      }
      await loadData()
    } finally {
      setProcessingId(null)
    }
  }

  const approveSale = async (saleId: string) => {
    setProcessingId(saleId)
    try {
      const { error } = await supabase.functions.invoke('approve-sale', {
        body: { saleId, platformFeeRate: Number(import.meta.env.VITE_PLATFORM_FEE_PERCENT || 0.05) },
      })
      if (error) {
        await supabase.from('sale_requests').update({ status: 'approved', admin_verified_at: new Date().toISOString() }).eq('id', saleId)
      }
      await loadData()
    } finally {
      setProcessingId(null)
    }
  }

  const resolveFlag = async (flagId: string) => {
    setProcessingId(flagId)
    try {
      await supabase.from('fraud_flags').update({ status: 'completed' }).eq('id', flagId)
      await loadData()
    } finally {
      setProcessingId(null)
    }
  }

  const rejectEntity = async () => {
    if (!rejectTarget || !rejectReason.trim()) return
    setProcessingId(rejectTarget.id)
    try {
      if (rejectTarget.type === 'farmers' || rejectTarget.type === 'investors') {
        await supabase.from('profiles').update({ status: 'rejected' }).eq('id', rejectTarget.id)
        await supabase.from('kyc_documents').update({ status: 'rejected', notes: rejectReason }).eq('user_id', rejectTarget.id).eq('status', 'pending')
      }
      if (rejectTarget.type === 'projects') {
        await supabase.from('livestock').update({ status: 'rejected' }).eq('id', rejectTarget.id)
      }
      if (rejectTarget.type === 'sales') {
        await supabase.from('sale_requests').update({ status: 'rejected' }).eq('id', rejectTarget.id)
      }
      if (rejectTarget.type === 'risk') {
        await supabase.from('fraud_flags').update({ status: 'rejected' }).eq('id', rejectTarget.id)
      }
      setRejectOpen(false)
      setRejectReason('')
      setRejectTarget(null)
      await loadData()
    } finally {
      setProcessingId(null)
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
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-900">Admin Approvals</h1>
          <p className="text-sm text-stone-600">Manual verification workflow for KYC, projects, sales and risk controls.</p>
        </div>

        <Card className="premium-shell border-0 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              <TabButton active={activeTab === 'farmers'} onClick={() => setActiveTab('farmers')} icon={<Users className="h-4 w-4" />} label={`Farmers (${farmers.length})`} />
              <TabButton active={activeTab === 'investors'} onClick={() => setActiveTab('investors')} icon={<Users className="h-4 w-4" />} label={`Investors (${investors.length})`} />
              <TabButton active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} icon={<Sprout className="h-4 w-4" />} label={`Projects (${pendingProjects.length})`} />
              <TabButton active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} icon={<Wallet className="h-4 w-4" />} label={`Sales (${pendingSales.length})`} />
              <TabButton active={activeTab === 'risk'} onClick={() => setActiveTab('risk')} icon={<Shield className="h-4 w-4" />} label={`Risk (${riskFlags.length})`} />
            </div>
            <div className="mt-4 relative max-w-sm">
              <Search className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input className="pl-10" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {activeTab === 'farmers' && (
          <KycTable
            title="Farmer KYC Decisions"
            description="Select user and verify all required files in one place."
            data={filteredFarmers}
            processingId={processingId}
            onApprove={approveUser}
            onReject={(id) => { setRejectTarget({ type: 'farmers', id }); setRejectOpen(true) }}
          />
        )}

        {activeTab === 'investors' && (
          <KycTable
            title="Investor KYC Decisions"
            description="Investor approval is required before project funding access."
            data={filteredInvestors}
            processingId={processingId}
            onApprove={approveUser}
            onReject={(id) => { setRejectTarget({ type: 'investors', id }); setRejectOpen(true) }}
          />
        )}

        {activeTab === 'projects' && (
          <Card className="premium-shell border-0">
            <CardHeader>
              <CardTitle>Financing Project Approvals</CardTitle>
              <CardDescription>Approve project after economics and documentation check.</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredProjects.length === 0 ? <EmptyState text="No pending projects." /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Shares</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <p className="font-medium">{p.title}</p>
                          <p className="text-xs text-stone-500">{p.breed || 'Mixed'} • {p.weight_kg}kg</p>
                        </TableCell>
                        <TableCell>{formatCurrency(p.cost_price || 0)}</TableCell>
                        <TableCell>{p.total_shares} @ {formatCurrency(p.price_per_share || 0)}</TableCell>
                        <TableCell>{formatDate(p.created_at)}</TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => approveProject(p.id)} disabled={processingId === p.id}>
                            {processingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-300" onClick={() => { setRejectTarget({ type: 'projects', id: p.id }); setRejectOpen(true) }}>Reject</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'sales' && (
          <Card className="premium-shell border-0">
            <CardHeader>
              <CardTitle>Sale Approval Queue</CardTitle>
              <CardDescription>Manual verification before payout distribution.</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredSales.length === 0 ? <EmptyState text="No pending sales." /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sale ID</TableHead>
                      <TableHead>Proposed Price</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.id.slice(0, 10)}...</TableCell>
                        <TableCell>{formatCurrency(s.proposed_price || s.sale_price || 0)}</TableCell>
                        <TableCell>{formatDate(s.created_at)}</TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => approveSale(s.id)} disabled={processingId === s.id}>
                            {processingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-300" onClick={() => { setRejectTarget({ type: 'sales', id: s.id }); setRejectOpen(true) }}>Reject</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'risk' && (
          <Card className="premium-shell border-0">
            <CardHeader>
              <CardTitle>Risk & Fraud Flags</CardTitle>
              <CardDescription>Review and resolve anomalies from the risk engine.</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredFlags.length === 0 ? <EmptyState text="No pending risk flags." /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFlags.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell><Badge variant="warning">{r.flag_type || 'risk'}</Badge></TableCell>
                        <TableCell>{r.severity || 1}</TableCell>
                        <TableCell className="max-w-md">{r.description || 'No details provided'}</TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => resolveFlag(r.id)} disabled={processingId === r.id}>
                            {processingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resolve'}
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-300" onClick={() => { setRejectTarget({ type: 'risk', id: r.id }); setRejectOpen(true) }}>Escalate</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provide Decision Note</DialogTitle>
            <DialogDescription>Reason will be recorded in admin history.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Reason..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={rejectEntity} disabled={!rejectReason.trim()}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function KycTable({
  title,
  description,
  data,
  processingId,
  onApprove,
  onReject,
}: {
  title: string
  description: string
  data: any[]
  processingId: string | null
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  return (
    <Card className="premium-shell border-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? <EmptyState text="No pending records." /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pending Docs</TableHead>
                <TableHead>Missing Docs</TableHead>
                <TableHead>KYC Bundle</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="font-medium">{row.full_name || 'Unnamed User'}</p>
                    <p className="text-xs text-stone-500">{row.phone || 'No phone'}</p>
                  </TableCell>
                  <TableCell><Badge variant={row.status === 'pending' ? 'warning' : 'secondary'}>{row.status}</Badge></TableCell>
                  <TableCell>{row.pendingDocsCount}</TableCell>
                  <TableCell>{row.missingRequiredCount}</TableCell>
                  <TableCell><KycViewer docs={row.docs || []} /></TableCell>
                  <TableCell>{formatDate(row.created_at)}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onApprove(row.id)} disabled={processingId === row.id}>
                      {processingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-300" onClick={() => onReject(row.id)}>Reject</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function KycViewer({ docs }: { docs: KycDoc[] }) {
  const requiredDocs = REQUIRED_KYC_DOCS.map((type) => docs.find((d) => d.document_type === type) || null)
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)

  useEffect(() => {
    const loadPreview = async () => {
      const current = requiredDocs[index]
      if (!open || !current?.file_url) {
        setViewerUrl(null)
        return
      }
      setLoading(true)
      try {
        const resolvedUrl = await resolveKycFileUrl(current.file_url)
        setViewerUrl(resolvedUrl)
      } catch {
        setViewerUrl(null)
      } finally {
        setLoading(false)
      }
    }
    loadPreview()
  }, [open, index, docs])

  const current = requiredDocs[index]
  const canNext = index < requiredDocs.length - 1
  const canPrev = index > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">View All Docs</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>KYC Manual Verification</DialogTitle>
          <DialogDescription>Review all required files in one secure in-app view.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {requiredDocs.map((doc, i) => (
              <button
                key={`${doc?.id || 'missing'}-${i}`}
                onClick={() => setIndex(i)}
                className={`rounded-md border px-2 py-2 text-left text-xs ${index === i ? 'border-green-500 bg-green-50' : 'border-stone-200 bg-white'}`}
              >
                <p className="font-medium">{REQUIRED_KYC_DOCS[i].replace('_', ' ')}</p>
                <p className="text-stone-500">{doc ? doc.status : 'missing'}</p>
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 min-h-[420px] flex items-center justify-center">
            {!current && (
              <div className="text-center text-stone-500">
                <X className="h-8 w-8 mx-auto mb-2" />
                <p>Required file is missing</p>
              </div>
            )}
            {current && loading && <Loader2 className="h-8 w-8 animate-spin text-stone-500" />}
            {current && !loading && viewerUrl && (
              isPdfUrl(current.file_url) ? (
                <iframe title="KYC PDF" src={viewerUrl} className="w-full h-[400px] rounded-md bg-white" />
              ) : (
                <img src={viewerUrl} alt="KYC document" className="max-h-[400px] w-auto rounded-md object-contain" />
              )
            )}
            {current && !loading && !viewerUrl && (
              <p className="text-sm text-red-600">Unable to load preview for this file.</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setIndex((v) => Math.max(v - 1, 0))} disabled={!canPrev}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <p className="text-xs text-stone-500">Doc {index + 1} of {requiredDocs.length}</p>
            <Button variant="outline" size="sm" onClick={() => setIndex((v) => Math.min(v + 1, requiredDocs.length - 1))} disabled={!canNext}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

async function resolveKycFileUrl(raw: string) {
  if (raw.startsWith('storage://')) {
    const stripped = raw.replace('storage://', '')
    const [bucket, ...rest] = stripped.split('/')
    const filePath = rest.join('/')
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 120)
    if (error || !data?.signedUrl) throw new Error('Unable to create signed URL')
    return data.signedUrl
  }
  if (raw.includes('/storage/v1/object/public/')) {
    const marker = '/storage/v1/object/public/'
    const remainder = raw.slice(raw.indexOf(marker) + marker.length)
    const [bucket, ...rest] = remainder.split('/')
    if (bucket && rest.length > 0) {
      const filePath = decodeURIComponent(rest.join('/').split('?')[0])
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 120)
      if (!error && data?.signedUrl) return data.signedUrl
    }
  }
  return raw
}

function isPdfUrl(url: string) {
  return url.toLowerCase().split('?')[0].includes('.pdf')
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${active ? 'bg-green-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
    >
      {icon}
      {label}
    </button>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-12 text-stone-500">
      <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p>{text}</p>
    </div>
  )
}

function filterBySearch(items: any[], search: string) {
  const q = search.toLowerCase()
  return items.filter((item) => `${item.full_name || ''} ${item.phone || ''}`.toLowerCase().includes(q))
}
