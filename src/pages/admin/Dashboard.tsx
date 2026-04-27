import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { formatCurrency } from '../../lib/utils'
import DashboardShell from '../../components/dashboard/DashboardShell'
import MetricTile from '../../components/dashboard/MetricTile'
import {
  AlertTriangle,
  Clock,
  FileText,
  Shield,
  TrendingUp,
  Users,
  Wallet,
  RefreshCw,
} from 'lucide-react'

type AdminStats = {
  pendingKyc: number
  pendingInvestorKyc: number
  pendingProjects: number
  pendingSales: number
  pendingMedical: number
  pendingRiskFlags: number
  activeProjects: number
  approvedFarmers: number
  fundedVolume: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    pendingKyc: 0,
    pendingInvestorKyc: 0,
    pendingProjects: 0,
    pendingSales: 0,
    pendingMedical: 0,
    pendingRiskFlags: 0,
    activeProjects: 0,
    approvedFarmers: 0,
    fundedVolume: 0,
  })
  const [loading, setLoading] = useState(true)
  const [recentProjects, setRecentProjects] = useState<any[]>([])

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const [
        kycRes,
        projectsRes,
        salesRes,
        medicalRes,
        riskRes,
        activeProjectsRes,
        farmersRes,
        investorsPendingRes,
        livestockRes,
      ] = await Promise.all([
        supabase.from('kyc_documents').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('livestock').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('sale_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('medical_assignments').select('*', { count: 'exact', head: true }).in('status', ['pending', 'unassigned', 'in_progress']),
        supabase.from('fraud_flags').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('livestock').select('*', { count: 'exact', head: true }).in('status', ['active', 'funded', 'in_progress']),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'farmer').eq('status', 'approved'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'investor').eq('status', 'pending'),
        supabase.from('livestock').select('title,total_shares,shares_available,price_per_share,created_at,status').order('created_at', { ascending: false }).limit(6),
      ])

      const fundedVolume = (livestockRes.data || []).reduce((sum: number, item: any) => {
        const soldShares = (item.total_shares || 0) - (item.shares_available || 0)
        return sum + soldShares * (item.price_per_share || 0)
      }, 0)

      setStats({
        pendingKyc: kycRes.count || 0,
        pendingInvestorKyc: investorsPendingRes.count || 0,
        pendingProjects: projectsRes.count || 0,
        pendingSales: salesRes.count || 0,
        pendingMedical: medicalRes.count || 0,
        pendingRiskFlags: riskRes.count || 0,
        activeProjects: activeProjectsRes.count || 0,
        approvedFarmers: farmersRes.count || 0,
        fundedVolume,
      })
      setRecentProjects(livestockRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  const blockerCount = useMemo(
    () => stats.pendingKyc + stats.pendingProjects + stats.pendingSales + stats.pendingMedical + stats.pendingRiskFlags,
    [stats]
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f2e8]">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-green-600" />
      </div>
    )
  }

  return (
    <DashboardShell
      label="Admin Risk Command"
      title="Operations Center"
      description="Control KYC, project approvals, veterinary clearance, insurance, treasury releases and fraud flags from one secure desk."
      side={(
        <>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/65">Action status</p>
              <div className="mt-4 flex items-center justify-between gap-4">
                <Badge variant={blockerCount > 0 ? 'warning' : 'success'}>
                  {blockerCount > 0 ? `${blockerCount} pending actions` : 'No pending blockers'}
                </Badge>
                <Button variant="outline" size="sm" onClick={loadDashboard} className="border-white/20 bg-white/10 text-white hover:bg-white/15">
                  <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                </Button>
              </div>
              <p className="mt-4 text-xs text-emerald-50/65">High-risk actions stay manual until policy, document and audit checks are complete.</p>
        </>
      )}
    >
      <div className="space-y-6">

        <div className="responsive-grid">
          <MetricTile label="Pending KYC" value={stats.pendingKyc.toString()} icon={<Users className="h-5 w-5" />} tone="amber" />
          <MetricTile label="Investor KYC Pending" value={stats.pendingInvestorKyc.toString()} icon={<Users className="h-5 w-5" />} tone="amber" />
          <MetricTile label="Project Approvals" value={stats.pendingProjects.toString()} icon={<FileText className="h-5 w-5" />} tone="blue" />
          <MetricTile label="Medical Reviews" value={stats.pendingMedical.toString()} icon={<Shield className="h-5 w-5" />} tone="emerald" />
          <MetricTile label="Sale Requests" value={stats.pendingSales.toString()} icon={<Wallet className="h-5 w-5" />} tone="emerald" />
          <MetricTile label="Risk Flags" value={stats.pendingRiskFlags.toString()} icon={<AlertTriangle className="h-5 w-5" />} tone="rose" />
          <MetricTile label="Active Projects" value={stats.activeProjects.toString()} icon={<TrendingUp className="h-5 w-5" />} tone="emerald" />
          <MetricTile label="Funded Volume" value={formatCurrency(stats.fundedVolume)} icon={<Shield className="h-5 w-5" />} tone="slate" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle>Admin Access Modules</CardTitle>
              <CardDescription>Everything an admin needs to run the financing platform safely.</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3">
              <Link to="/admin/approvals?tab=farmers"><QuickAction title="KYC Decisions" desc="Approve/reject farmer onboarding" /></Link>
              <Link to="/admin/approvals?tab=investors"><QuickAction title="Investor KYC" desc="Approve/reject investor onboarding" /></Link>
              <Link to="/admin/approvals?tab=projects"><QuickAction title="Project Screening" desc="Approve financing projects" /></Link>
              <Link to="/admin/medical"><QuickAction title="Medical & Insurance" desc="Doctor assignment, clearance and risk cover" /></Link>
              <Link to="/admin/approvals?tab=sales"><QuickAction title="Sale Verification" desc="Approve final sale and payout flow" /></Link>
              <Link to="/admin/treasury"><QuickAction title="Treasury Control" desc="Withdrawals + escrow releases" /></Link>
              <Link to="/admin/approvals?tab=risk"><QuickAction title="Risk Controls" desc="Resolve fraud and anomaly flags" /></Link>
              <Link to="/admin/audit"><QuickAction title="Audit Trail" desc="Track who changed what and when" /></Link>
              <Link to="/admin/policies"><QuickAction title="Policy Center" desc="Governance, compliance and SOPs" /></Link>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-stone-600" /> Fresh Projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentProjects.length === 0 ? (
                <p className="text-sm text-stone-500">No projects found.</p>
              ) : (
                recentProjects.slice(0, 5).map((p) => (
                  <div key={`${p.title}-${p.created_at}`} className="rounded-lg border border-stone-200 p-3">
                    <p className="font-medium text-stone-900 text-sm">{p.title}</p>
                    <p className="text-xs text-stone-500 capitalize">{p.status}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}

function QuickAction({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-amber-100 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/60">
      <p className="font-medium text-stone-900">{title}</p>
      <p className="text-xs text-stone-600 mt-1">{desc}</p>
    </div>
  )
}
