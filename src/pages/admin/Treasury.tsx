import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { formatCurrency, formatDate } from '../../lib/utils'
import { CircleDollarSign, Loader2, Wallet } from 'lucide-react'

export default function AdminTreasury() {
  const { profile } = useAuth()
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [fundedProjects, setFundedProjects] = useState<any[]>([])
  const [releases, setReleases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [releaseForm, setReleaseForm] = useState({ livestockId: '', amount: '', releaseType: 'initial_purchase', notes: '' })

  useEffect(() => {
    loadTreasury()
  }, [])

  const loadTreasury = async () => {
    setLoading(true)
    try {
      const [withdrawalRes, projectsRes, releaseRes] = await Promise.all([
        supabase
          .from('withdrawal_requests')
          .select('*, profile:profiles(full_name, role)')
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
        supabase
          .from('livestock')
          .select('id,title,farmer_id,status,cost_price,total_shares,shares_available,price_per_share, farmer:profiles(full_name,status)')
          .in('status', ['funded', 'in_progress', 'active'])
          .order('created_at', { ascending: false }),
        supabase
          .from('escrow_releases')
          .select('*, livestock:livestock(title), farmer:profiles(full_name)')
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      setWithdrawals(withdrawalRes.data || [])
      setFundedProjects(projectsRes.data || [])
      setReleases(releaseRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  const releaseStats = useMemo(() => {
    const released = releases.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    return { released }
  }, [releases])

  const processWithdrawal = async (request: any, approve: boolean) => {
    setBusyId(request.id)
    try {
      if (approve) {
        const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', request.user_id).single()
        if (!wallet) throw new Error('Wallet not found')
        const currentBalance = Number(wallet.main_balance || 0)
        if (currentBalance < Number(request.amount)) throw new Error('Insufficient user balance')

        const { error: walletErr } = await supabase
          .from('wallets')
          .update({ main_balance: currentBalance - Number(request.amount), updated_at: new Date().toISOString() })
          .eq('user_id', request.user_id)
        if (walletErr) throw walletErr

        const { error: txErr } = await supabase.from('transactions').insert({
          user_id: request.user_id,
          type: 'withdrawal',
          amount: Number(request.amount),
          status: 'completed',
          metadata: { request_id: request.id, method: request.method, iban: request.iban },
        })
        if (txErr) throw txErr
      }

      const { error } = await supabase
        .from('withdrawal_requests')
        .update({
          status: approve ? 'approved' : 'rejected',
          processed_by: profile?.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', request.id)
      if (error) throw error

      await loadTreasury()
    } catch (err: any) {
      alert(err.message || 'Failed to process withdrawal')
    } finally {
      setBusyId(null)
    }
  }

  const releaseEscrowToFarmer = async () => {
    const amount = Number(releaseForm.amount)
    if (!releaseForm.livestockId || !amount || amount <= 0) return alert('Select project and valid amount')
    setBusyId('release')

    try {
      const selectedProject = fundedProjects.find((p) => p.id === releaseForm.livestockId)
      if (!selectedProject) throw new Error('Project not found')
      if (selectedProject.farmer?.status !== 'approved') throw new Error('Farmer KYC must be approved before release')

      const [{ data: investments }, { data: currentReleases }] = await Promise.all([
        supabase.from('investments').select('investor_id, amount').eq('livestock_id', releaseForm.livestockId),
        supabase.from('escrow_releases').select('amount').eq('livestock_id', releaseForm.livestockId),
      ])

      const investorPool = (investments || []).reduce((sum, i) => sum + Number(i.amount || 0), 0)
      const alreadyReleased = (currentReleases || []).reduce((sum, i) => sum + Number(i.amount || 0), 0)
      const remaining = investorPool - alreadyReleased
      if (amount > remaining) throw new Error(`Release exceeds available escrow. Remaining: ${formatCurrency(remaining)}`)

      const fallbackLocalRelease = async () => {
        const investorById = new Map<string, number>()
        for (const inv of investments || []) {
          investorById.set(inv.investor_id, (investorById.get(inv.investor_id) || 0) + Number(inv.amount || 0))
        }

        for (const [investorId, investedAmount] of investorById.entries()) {
          const shareRatio = investorPool > 0 ? investedAmount / investorPool : 0
          const deduction = Number((amount * shareRatio).toFixed(2))
          const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', investorId).single()
          if (wallet) {
            const locked = Number(wallet.escrow_locked || 0)
            await supabase.from('wallets').update({ escrow_locked: Math.max(0, locked - deduction), updated_at: new Date().toISOString() }).eq('user_id', investorId)
            await supabase.from('transactions').insert({
              user_id: investorId,
              type: 'maintenance_release',
              amount: deduction,
              status: 'completed',
              metadata: { livestock_id: releaseForm.livestockId, release_type: releaseForm.releaseType },
            })
          }
        }

        const { data: farmerWallet } = await supabase.from('wallets').select('*').eq('user_id', selectedProject.farmer_id).single()
        if (farmerWallet) {
          await supabase
            .from('wallets')
            .update({ main_balance: Number(farmerWallet.main_balance || 0) + amount, updated_at: new Date().toISOString() })
            .eq('user_id', selectedProject.farmer_id)
        }

        const insertTx = await supabase.from('transactions').insert({
          user_id: selectedProject.farmer_id,
          type: 'farmer_payout',
          amount,
          status: 'completed',
          metadata: { livestock_id: releaseForm.livestockId, release_type: releaseForm.releaseType, notes: releaseForm.notes || null },
        })
        if (insertTx.error) {
          await supabase.from('transactions').insert({
            user_id: selectedProject.farmer_id,
            type: 'maintenance_release',
            amount,
            status: 'completed',
            metadata: { livestock_id: releaseForm.livestockId, release_type: releaseForm.releaseType, notes: releaseForm.notes || null },
          })
        }

        await supabase.from('escrow_releases').insert({
          livestock_id: releaseForm.livestockId,
          farmer_id: selectedProject.farmer_id,
          approved_by: profile?.id,
          amount,
          release_type: releaseForm.releaseType,
          notes: releaseForm.notes || null,
          status: 'completed',
        })
      }

      const { error: fnError } = await supabase.functions.invoke('release-escrow', {
        body: {
          livestockId: releaseForm.livestockId,
          amount,
          releaseType: releaseForm.releaseType,
          notes: releaseForm.notes,
          adminId: profile?.id,
        },
      })
      if (fnError) {
        await fallbackLocalRelease()
      }

      setReleaseForm({ livestockId: '', amount: '', releaseType: 'initial_purchase', notes: '' })
      await loadTreasury()
    } catch (err: any) {
      alert(err.message || 'Escrow release failed')
    } finally {
      setBusyId(null)
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
          <h1 className="text-2xl font-bold text-stone-900">Admin Treasury Control</h1>
          <p className="text-sm text-stone-600">Control wallet withdrawals and escrow releases with clear approvals.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card className="premium-shell border-0"><CardContent className="p-5"><p className="text-sm text-stone-600">Pending Withdrawals</p><p className="text-2xl font-bold">{withdrawals.length}</p></CardContent></Card>
          <Card className="premium-shell border-0"><CardContent className="p-5"><p className="text-sm text-stone-600">Active Funded Projects</p><p className="text-2xl font-bold">{fundedProjects.length}</p></CardContent></Card>
          <Card className="premium-shell border-0"><CardContent className="p-5"><p className="text-sm text-stone-600">Released to Farmers</p><p className="text-2xl font-bold">{formatCurrency(releaseStats.released)}</p></CardContent></Card>
        </div>

        <Card className="premium-shell border-0">
          <CardHeader>
            <CardTitle>Escrow Release to Farmer Wallet</CardTitle>
            <CardDescription>Release only after KYC approved farmer and milestone validation.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-5 gap-3">
            <select
              value={releaseForm.livestockId}
              onChange={(e) => setReleaseForm((p) => ({ ...p, livestockId: e.target.value }))}
              className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm md:col-span-2"
            >
              <option value="">Select funded project</option>
              {fundedProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.title} ({p.farmer?.full_name || 'Farmer'})</option>
              ))}
            </select>
            <Input value={releaseForm.amount} onChange={(e) => setReleaseForm((p) => ({ ...p, amount: e.target.value }))} placeholder="Amount (PKR)" />
            <select
              value={releaseForm.releaseType}
              onChange={(e) => setReleaseForm((p) => ({ ...p, releaseType: e.target.value }))}
              className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm"
            >
              <option value="initial_purchase">Initial Purchase</option>
              <option value="feed_milestone">Feed Milestone</option>
              <option value="vet_milestone">Vet Milestone</option>
              <option value="ops_expense">Ops Expense</option>
            </select>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={busyId === 'release'} onClick={releaseEscrowToFarmer}>
              {busyId === 'release' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Release'}
            </Button>
            <Input className="md:col-span-5" value={releaseForm.notes} onChange={(e) => setReleaseForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes / milestone proof" />
          </CardContent>
        </Card>

        <Card className="premium-shell border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-emerald-700" /> Withdrawal Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {withdrawals.length === 0 ? (
              <p className="text-sm text-stone-500 text-center py-8">No pending withdrawals.</p>
            ) : (
              withdrawals.map((w) => (
                <div key={w.id} className="rounded-lg border border-stone-200 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="font-medium text-stone-900">{w.profile?.full_name || 'User'} • {w.profile?.role}</p>
                    <p className="text-xs text-stone-500">{formatDate(w.created_at)} • {w.method} • {w.iban}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-900">{formatCurrency(Number(w.amount || 0))}</span>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={busyId === w.id} onClick={() => processWithdrawal(w, true)}>
                      {busyId === w.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busyId === w.id} onClick={() => processWithdrawal(w, false)}>Reject</Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="premium-shell border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-blue-700" /> Latest Escrow Releases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {releases.length === 0 ? (
              <p className="text-sm text-stone-500 text-center py-8">No releases yet.</p>
            ) : (
              releases.map((item) => (
                <div key={item.id} className="rounded-lg border border-stone-200 p-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{item.livestock?.title || 'Project'} → {item.farmer?.full_name || 'Farmer'}</p>
                    <p className="text-xs text-stone-500">{item.release_type} • {formatDate(item.created_at)}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700">{formatCurrency(Number(item.amount || 0))}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
