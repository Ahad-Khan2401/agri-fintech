import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { formatCurrency } from '../../lib/utils'
import DashboardShell from '../../components/dashboard/DashboardShell'
import MetricTile from '../../components/dashboard/MetricTile'
import { AllocationBars, Sparkline } from '../../components/dashboard/MiniCharts'
import { 
  Wallet, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  ArrowRight,
  PieChart,
  Activity,
  DollarSign,
} from 'lucide-react'

export default function InvestorDashboard() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [portfolio, setPortfolio] = useState({
    totalInvested: 0,
    portfolioValue: 0,
    activeInvestments: 0,
    completedInvestments: 0,
    profitEarned: 0
  })
  const [investments, setInvestments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) {
      loadPortfolio()
    }
  }, [profile])

  const loadPortfolio = async () => {
    try {
      const {  data: invData } = await supabase
        .from('investments')
        .select(`
          *,
          livestock:livestock(*, farmer:profiles(phone))
        `)
        .eq('investor_id', profile!.id)

      const totalInvested = invData?.reduce((sum, inv) => sum + inv.amount, 0) || 0
      const activeCount = invData?.filter(i => i.livestock?.status === 'active' || i.livestock?.status === 'funded').length || 0
      const completedCount = invData?.filter(i => i.livestock?.status === 'sold').length || 0
      
      // Calculate profit (simplified - in real app, calculate from sale_requests)
      const profitEarned = completedCount * 50000 // Demo data

      setPortfolio({
        totalInvested,
        portfolioValue: totalInvested + profitEarned,
        activeInvestments: activeCount,
        completedInvestments: completedCount,
        profitEarned
      })

      setInvestments(invData || [])
    } catch (err) {
      console.error('Failed to load portfolio:', err)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: PieChart },
    { id: 'animals', label: 'My Animals', icon: Activity },
    { id: 'updates', label: 'Updates Feed', icon: Clock },
    { id: 'earnings', label: 'Earnings', icon: DollarSign },
  ]

  const trendData = [
    { label: 'Jan', value: portfolio.totalInvested * 0.18 },
    { label: 'Feb', value: portfolio.totalInvested * 0.34 },
    { label: 'Mar', value: portfolio.totalInvested * 0.58 },
    { label: 'Apr', value: portfolio.portfolioValue || 1 },
  ]

  const allocationData = [
    { label: 'Active Livestock', value: portfolio.activeInvestments || 1 },
    { label: 'Completed Exits', value: portfolio.completedInvestments || 1 },
    { label: 'Profit Reserve', value: portfolio.profitEarned > 0 ? portfolio.profitEarned : 1 },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f2e8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
      </div>
    )
  }

  const isDark = theme === 'dark'

  return (
    <div className={isDark ? 'bg-[#0f1716] text-white' : ''}>
      <DashboardShell
        label="Investor Command Desk"
        title={`${profile?.full_name || profile?.phone || 'Investor'} Portfolio`}
        description="Real-time data visualization for livestock financing, escrow safety, profit tracking and insured project exposure."
        actions={(
          <>
            <Link to="/listings"><Button className="bg-amber-300 text-stone-950 hover:bg-amber-200">View Cleared Projects <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            <Link to="/investor/wallet"><Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15">Wallet</Button></Link>
            <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15" onClick={() => setTheme(isDark ? 'light' : 'dark')}>
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </Button>
          </>
        )}
        side={(
          <>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/65">Trust stack</p>
            <div className="mt-4 space-y-3 text-sm text-emerald-50/85">
              <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-300" /> KYC verified farmers</div>
              <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-300" /> Vet-cleared livestock</div>
              <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-300" /> Escrow and insurance controls</div>
            </div>
          </>
        )}
      >
        <div className="responsive-grid mb-6">
          <MetricTile
            icon={<Wallet className="h-5 w-5" />}
            label="Capital Deployed"
            value={formatCurrency(portfolio.totalInvested)}
            tone="emerald"
          />
          <MetricTile
            icon={<TrendingUp className="h-5 w-5" />}
            label="Est. Portfolio Value"
            value={formatCurrency(portfolio.portfolioValue)}
            tone="blue"
          />
          <MetricTile
            icon={<Clock className="h-5 w-5" />}
            label="Active Projects"
            value={portfolio.activeInvestments.toString()}
            subtext={`${portfolio.completedInvestments} completed`}
            tone="amber"
          />
          <MetricTile
            icon={<CheckCircle className="h-5 w-5" />}
            label="Profit Earned"
            value={formatCurrency(portfolio.profitEarned)}
            tone="slate"
          />
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-5">
          <Card className={`premium-shell border-0 lg:col-span-3 ${isDark ? 'bg-[#172220]/95 text-white border-white/10' : ''}`}>
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Portfolio Growth</h3>
                  <p className={`text-sm ${isDark ? 'text-emerald-50/65' : 'text-stone-500'}`}>Live trend visualization for deployed capital.</p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700">Realtime Ready</Badge>
              </div>
              <Sparkline data={trendData} stroke={isDark ? '#67e8b9' : '#0f8f68'} />
            </CardContent>
          </Card>

          <Card className={`premium-shell border-0 lg:col-span-2 ${isDark ? 'bg-[#172220]/95 text-white border-white/10' : ''}`}>
            <CardContent className="p-6">
              <h3 className="mb-1 text-xl font-bold">Allocation Mix</h3>
              <p className={`mb-5 text-sm ${isDark ? 'text-emerald-50/65' : 'text-stone-500'}`}>Project exposure by state.</p>
              <AllocationBars data={allocationData} />
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="bg-white/85 rounded-lg border border-amber-100 p-1 inline-flex shadow-sm backdrop-blur">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
                    activeTab === tab.id
                      ? 'bg-stone-100 text-stone-900'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div>
            {investments.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PieChart className="h-8 w-8 text-stone-400" />
                  </div>
                  <h3 className="text-xl font-bold text-stone-900 mb-2">No portfolio data yet</h3>
                  <p className="text-stone-600 mb-6">Fund your first farmer project to see portfolio analytics.</p>
                  <Link to="/listings">
                    <Button className="bg-green-600 hover:bg-green-700">
                      Explore Projects
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {investments.slice(0, 3).map((inv) => (
                  <InvestmentCard key={inv.id} investment={inv} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'animals' && (
          <div className="space-y-4">
            {investments.length === 0 ? (
              <EmptyState message="No animals in your portfolio yet" />
            ) : (
              investments.map((inv) => <InvestmentCard key={inv.id} investment={inv} />)
            )}
          </div>
        )}

        {activeTab === 'updates' && (
          <div className="space-y-4">
            <EmptyState message="No updates yet. Updates will appear here when farmers post them." />
          </div>
        )}

        {activeTab === 'earnings' && (
          <div className="space-y-4">
            <EmptyState message="No earnings yet. Profits will appear here when your animals are sold." />
          </div>
        )}
      </DashboardShell>
    </div>
  )
}

function InvestmentCard({ investment }: any) {
  const livestock = investment.livestock
  const statusColors: any = {
    active: 'bg-green-100 text-green-700',
    funded: 'bg-blue-100 text-blue-700',
    sold: 'bg-purple-100 text-purple-700',
    loss: 'bg-red-100 text-red-700'
  }

  const fundedPercent = livestock 
    ? Math.round(((livestock.total_shares - livestock.shares_available) / livestock.total_shares) * 100)
    : 0

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 bg-stone-200 rounded-lg flex items-center justify-center">
              <span className="text-stone-400 text-xs">No Image</span>
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-lg">{livestock?.title || 'Unknown'}</h3>
              <p className="text-stone-600 text-sm">
                {livestock?.breed} • {livestock?.weight_kg}kg
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={`text-xs ${statusColors[livestock?.status] || 'bg-stone-100 text-stone-700'}`}>
                  {livestock?.status || 'unknown'}
                </Badge>
                <span className="text-xs text-stone-500">
                  {investment.shares} shares • {investment.ownership_percent}%
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-lg font-bold text-stone-900">{formatCurrency(investment.amount)}</p>
            <div className="w-full lg:w-48 bg-stone-100 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${fundedPercent}%` }}
              />
            </div>
            <span className="text-xs text-stone-600">{fundedPercent}% funded</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-12 text-center">
        <p className="text-stone-600">{message}</p>
      </CardContent>
    </Card>
  )
}
