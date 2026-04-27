import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../store/auth'
import { supabase } from '../../lib/supabase'
import { Card, CardContent } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { formatCurrency, formatDate } from '../../lib/utils'
import { CircleDollarSign, Clock, Landmark, Wallet as WalletIcon } from 'lucide-react'

export default function FarmerWallet() {
  const { profile } = useAuth()
  const [wallet, setWallet] = useState<any>(null)
  const [releases, setReleases] = useState<any[]>([])
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [iban, setIban] = useState('')
  const [accountTitle, setAccountTitle] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) loadWallet()
  }, [profile])

  const loadWallet = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const [walletRes, releaseRes, withdrawalRes] = await Promise.all([
        supabase.from('wallets').select('*').eq('user_id', profile.id).single(),
        supabase
          .from('escrow_releases')
          .select('*, livestock:livestock(title)')
          .eq('farmer_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('withdrawal_requests')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      setWallet(walletRes.data)
      setReleases(releaseRes.data || [])
      setWithdrawals(withdrawalRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  const totalReleased = useMemo(() => releases.reduce((sum, r) => sum + Number(r.amount || 0), 0), [releases])

  const handleWithdrawRequest = async () => {
    const amount = parseFloat(withdrawAmount)
    if (!amount || amount < 1000) return alert('Minimum withdrawal: PKR 1,000')
    if (amount > Number(wallet?.main_balance || 0)) return alert('Insufficient wallet balance')
    if (!iban.trim() || !accountTitle.trim()) return alert('Account title and IBAN are required')

    const { error } = await supabase.from('withdrawal_requests').insert({
      user_id: profile?.id,
      amount,
      iban: iban.trim(),
      account_title: accountTitle.trim(),
      method: 'bank_transfer',
      status: 'pending',
    })
    if (error) return alert(error.message)

    setWithdrawAmount('')
    setIban('')
    setAccountTitle('')
    alert('Withdrawal request submitted. Admin treasury will review it.')
    loadWallet()
  }

  if (loading) return <div className="p-12 text-center">Loading farmer wallet...</div>

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-stone-900 mb-8">Farmer Wallet & Payouts</h1>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="premium-shell border-0 bg-emerald-700 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <WalletIcon className="h-6 w-6 text-emerald-100" />
              <span className="text-sm text-emerald-100">Available Balance</span>
            </div>
            <p className="text-3xl font-bold">{formatCurrency(Number(wallet?.main_balance || 0))}</p>
          </CardContent>
        </Card>
        <Card className="premium-shell border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <CircleDollarSign className="h-6 w-6 text-blue-600" />
              <span className="text-sm text-stone-500">Investor Releases</span>
            </div>
            <p className="text-3xl font-bold text-stone-900">{formatCurrency(totalReleased)}</p>
          </CardContent>
        </Card>
        <Card className="premium-shell border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Clock className="h-6 w-6 text-stone-500" />
              <span className="text-sm text-stone-500">Pending Withdrawals</span>
            </div>
            <p className="text-3xl font-bold text-stone-900">{withdrawals.filter((w) => w.status === 'pending').length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <Card className="premium-shell border-0 lg:col-span-1">
          <CardContent className="p-6 space-y-3">
            <h3 className="font-semibold text-lg">Withdraw to Bank</h3>
            <Input type="number" placeholder="Withdrawal amount (PKR)" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
            <Input placeholder="Account title" value={accountTitle} onChange={(e) => setAccountTitle(e.target.value)} />
            <Input placeholder="IBAN (PK...)" value={iban} onChange={(e) => setIban(e.target.value)} />
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleWithdrawRequest}>
              <Landmark className="h-4 w-4 mr-2" /> Request Withdrawal
            </Button>
          </CardContent>
        </Card>

        <Card className="premium-shell border-0 lg:col-span-2">
          <CardContent className="p-6">
            <h3 className="font-semibold text-lg mb-3">Escrow Releases from Investor Pool</h3>
            <div className="space-y-2">
              {releases.length === 0 ? (
                <p className="text-sm text-stone-500 py-8 text-center">No release entries yet.</p>
              ) : (
                releases.map((release) => (
                  <div key={release.id} className="rounded-lg border border-stone-200 p-3 text-sm flex items-center justify-between">
                    <div>
                      <p className="font-medium text-stone-900">{release.livestock?.title || 'Livestock Project'}</p>
                      <p className="text-xs text-stone-500">{release.release_type} • {formatDate(release.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-700">{formatCurrency(Number(release.amount || 0))}</p>
                      <Badge className="bg-green-100 text-green-700">{release.status || 'completed'}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
