import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { formatCurrency, formatDate } from '../../lib/utils'
import { Plus, Users, Wallet, TrendingUp, AlertTriangle, Calculator, ArrowRight } from 'lucide-react'
import DashboardShell from '../../components/dashboard/DashboardShell'
import MetricTile from '../../components/dashboard/MetricTile'
import AccountReviewCard from '../../components/auth/AccountReviewCard'

export default function FarmerDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [livestock, setLivestock] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [calculator, setCalculator] = useState({
    animals: 10,
    buyPrice: 120000,
    salePrice: 140000,
    platformFeePct: 10,
    farmerProfitSharePct: 60,
  })

  const isKycApproved = profile?.status === 'approved'

  useEffect(() => {
    if (profile) loadDashboard()
  }, [profile])

  const loadDashboard = async () => {
    try {
      const { data, error } = await supabase
        .from('livestock')
        .select('*')
        .eq('farmer_id', profile!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setLivestock(data || [])
    } catch (err) {
      console.error('Failed to load farmer dashboard', err)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const totalProjects = livestock.length
    const fundedProjects = livestock.filter((l) => ['funded', 'in_progress', 'active', 'medical_review'].includes(l.status)).length
    const totalRaised = livestock.reduce((sum, l) => {
      const soldShares = (l.total_shares || 0) - (l.shares_available || 0)
      return sum + soldShares * (l.price_per_share || 0)
    }, 0)
    const pendingApprovals = livestock.filter((l) => ['draft', 'medical_review'].includes(l.status)).length
    return { totalProjects, fundedProjects, totalRaised, pendingApprovals }
  }, [livestock])

  const calcResult = useMemo(() => {
    const grossCost = calculator.animals * calculator.buyPrice
    const grossSale = calculator.animals * calculator.salePrice
    const grossProfit = grossSale - grossCost
    const platformFee = grossProfit > 0 ? (grossProfit * calculator.platformFeePct) / 100 : 0
    const distributable = grossProfit - platformFee
    const farmerShare = (distributable * calculator.farmerProfitSharePct) / 100
    const investorShare = distributable - farmerShare
    return { grossCost, grossSale, grossProfit, platformFee, farmerShare, investorShare }
  }, [calculator])

  const handleRequestSale = async (livestockId: string) => {
    const proposedPrice = prompt('Proposed sale price (PKR):')
    if (!proposedPrice || Number.isNaN(Number(proposedPrice))) return
    try {
      const { error } = await supabase.from('sale_requests').insert([
        {
          livestock_id: livestockId,
          farmer_id: profile?.id,
          proposed_price: Number(proposedPrice),
          status: 'pending',
        },
      ])
      if (error) throw error
      alert('Sale request submitted for admin review.')
    } catch (err: any) {
      alert(err.message || 'Failed to submit sale request')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-green-600" />
      </div>
    )
  }

  if (profile && !isKycApproved) {
    return <AccountReviewCard profile={profile} />
  }

  return (
    <DashboardShell
      label="Farmer Growth Desk"
      title="Simple livestock operations"
      description="Icon-based controls for financing requests, medical review, wallet balance and sale approvals."
      actions={(
        <>
          <Link to="/farmer/wallet"><Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15">Wallet</Button></Link>
          <Link to={isKycApproved ? '/farmer/add' : '#'} onClick={(e) => !isKycApproved && e.preventDefault()}>
            <Button className="bg-amber-300 text-stone-950 hover:bg-amber-200" disabled={!isKycApproved}><Plus className="mr-2 h-4 w-4" /> New Animal</Button>
          </Link>
        </>
      )}
      side={(
        <div className="space-y-3 text-sm text-emerald-50/85">
          <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-emerald-300" /> Zero-capital scaling</div>
          <div className="flex items-center gap-2"><Users className="h-4 w-4 text-emerald-300" /> Shared investor risk</div>
          <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-300" /> Better sale price target</div>
        </div>
      )}
    >
        <div className="responsive-grid mb-6">
          <MetricTile label="Total Projects" value={stats.totalProjects.toString()} icon={<Wallet className="h-5 w-5" />} tone="blue" />
          <MetricTile label="Funded / Active" value={stats.fundedProjects.toString()} icon={<TrendingUp className="h-5 w-5" />} tone="emerald" />
          <MetricTile label="Capital Raised" value={formatCurrency(stats.totalRaised)} icon={<Users className="h-5 w-5" />} tone="slate" />
          <MetricTile label="Admin / Medical Review" value={stats.pendingApprovals.toString()} icon={<AlertTriangle className="h-5 w-5" />} tone="amber" />
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-5">
          <Card className="border-0 shadow-sm lg:col-span-3">
            <CardHeader>
              <CardTitle>Operating Projects</CardTitle>
              <CardDescription>Farmer as operator model: grow, update, and exit with better pricing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {livestock.length === 0 ? (
                <div className="rounded-lg border border-dashed border-stone-300 p-10 text-center">
                  <p className="mb-4 text-stone-600">No projects yet. Start your first financed herd cycle.</p>
                  <Link to="/farmer/add">
                    <Button className="bg-green-600 hover:bg-green-700">Create First Project</Button>
                  </Link>
                </div>
              ) : (
                livestock.map((item) => {
                  const fundedPercent = Math.round((((item.total_shares || 0) - (item.shares_available || 0)) / (item.total_shares || 1)) * 100)
                  return (
                    <div key={item.id} className="rounded-lg border border-stone-200 p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-stone-900">{item.title}</h3>
                          <p className="text-xs text-stone-500">{item.breed || 'Mixed'} • Listed {formatDate(item.created_at)}</p>
                        </div>
                        <Badge variant="outline" className="capitalize">{item.status}</Badge>
                      </div>
                      <div className="mb-3 h-2 rounded-full bg-stone-100">
                        <div className="h-2 rounded-full bg-green-600" style={{ width: `${Math.min(fundedPercent, 100)}%` }} />
                      </div>
                      <div className="mb-3 flex justify-between text-xs text-stone-600">
                        <span>{item.shares_available}/{item.total_shares} shares remaining</span>
                        <span>{fundedPercent}% funded</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/farmer/livestock/${item.id}/updates`)}>Post Update</Button>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/livestock/${item.id}`)}>View</Button>
                        {['active', 'funded', 'in_progress'].includes(item.status) && (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleRequestSale(item.id)}>
                            Request Sale Approval
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-green-600" /> Profit Model Calculator</CardTitle>
              <CardDescription>Estimate farmer upside in financing + risk-sharing model.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-stone-600">Number of animals</label>
                <Input type="number" value={calculator.animals} onChange={(e) => setCalculator((p) => ({ ...p, animals: Number(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-stone-600">Buy price per animal (PKR)</label>
                <Input type="number" value={calculator.buyPrice} onChange={(e) => setCalculator((p) => ({ ...p, buyPrice: Number(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-stone-600">Target sale price per animal (PKR)</label>
                <Input type="number" value={calculator.salePrice} onChange={(e) => setCalculator((p) => ({ ...p, salePrice: Number(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-stone-600">Platform fee on profit (%)</label>
                <Input type="number" value={calculator.platformFeePct} onChange={(e) => setCalculator((p) => ({ ...p, platformFeePct: Number(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-stone-600">Farmer share from distributable profit (%)</label>
                <Input type="number" value={calculator.farmerProfitSharePct} onChange={(e) => setCalculator((p) => ({ ...p, farmerProfitSharePct: Number(e.target.value) || 0 }))} />
              </div>
              <div className="rounded-lg bg-stone-100 p-4 text-sm">
                <p className="mb-1 text-stone-600">Total financed cost</p>
                <p className="font-semibold text-stone-900">{formatCurrency(calcResult.grossCost)}</p>
                <p className="mt-3 mb-1 text-stone-600">Expected gross profit</p>
                <p className="font-semibold text-stone-900">{formatCurrency(calcResult.grossProfit)}</p>
                <p className="mt-3 mb-1 text-stone-600">Farmer estimated profit share</p>
                <p className="font-semibold text-green-700">{formatCurrency(calcResult.farmerShare)}</p>
                <p className="mt-3 mb-1 text-stone-600">Investor estimated profit share</p>
                <p className="font-semibold text-blue-700">{formatCurrency(calcResult.investorShare)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 bg-gradient-to-r from-green-50 to-emerald-50 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold text-stone-900">Farmer pitch line</p>
              <p className="text-sm text-stone-700">
                "Aap apne paise se nahi, logon ke paise se zyada janwar pal sakte ho. Risk share hoga aur better sale par profit bhi."
              </p>
            </div>
            <Link to="/farmer/add">
              <Button className="bg-green-600 hover:bg-green-700">Launch New Cycle <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
          </CardContent>
        </Card>
    </DashboardShell>
  )
}
