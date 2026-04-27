import { useEffect, useState } from 'react'
import { useWallet } from '../../store/wallet'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { formatCurrency, formatDate } from '../../lib/utils'
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Shield, Landmark, CircleDollarSign } from 'lucide-react'

export default function InvestorWallet() {
  const { balance, escrowLocked, transactions, withdrawalRequests, deposit, requestWithdrawal, loadWallet } = useWallet()
  const [amount, setAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [accountTitle, setAccountTitle] = useState('')
  const [iban, setIban] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    useWallet.getState().loadWallet()
  }, [])

  const handleDeposit = async () => {
    const val = parseFloat(amount)
    if (!val || val < 5000) return alert('Minimum deposit: PKR 5,000')
    setLoading(true)
    const res = await deposit(val)
    if (!res.success) alert(res.error || 'Deposit failed')
    setAmount('')
    await loadWallet()
    setLoading(false)
  }

  const handleWithdraw = async () => {
    const val = parseFloat(withdrawAmount)
    if (!val || val < 1000) return alert('Minimum withdrawal: PKR 1,000')
    if (!accountTitle.trim() || !iban.trim()) return alert('Account title and IBAN are required')
    setLoading(true)
    const res = await requestWithdrawal(val, accountTitle.trim(), iban.trim())
    if (!res.success) alert(res.error || 'Withdrawal request failed')
    else {
      setWithdrawAmount('')
      setAccountTitle('')
      setIban('')
      alert('Withdrawal request submitted for admin approval.')
    }
    await loadWallet()
    setLoading(false)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-stone-900 mb-8">Investor Treasury Wallet</h1>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="premium-shell border-0 bg-emerald-700 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <WalletIcon className="h-6 w-6 text-emerald-100" />
              <span className="text-emerald-100 text-sm font-medium">Available Balance</span>
            </div>
            <p className="text-3xl font-bold">{formatCurrency(balance)}</p>
            <p className="text-emerald-100 text-sm mt-1">Ready for new livestock cycles</p>
          </CardContent>
        </Card>

        <Card className="premium-shell border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Shield className="h-6 w-6 text-blue-600" />
              <span className="text-stone-500 text-sm font-medium">Escrow Reserve</span>
            </div>
            <p className="text-3xl font-bold text-stone-900">{formatCurrency(escrowLocked)}</p>
            <p className="text-stone-500 text-sm mt-1">Held in safeguarded project escrow</p>
          </CardContent>
        </Card>

        <Card className="premium-shell border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Landmark className="h-6 w-6 text-stone-400" />
              <span className="text-stone-500 text-sm font-medium">Pending Withdrawals</span>
            </div>
            <p className="text-3xl font-bold text-stone-900">{withdrawalRequests.filter((w) => w.status === 'pending').length}</p>
            <p className="text-stone-500 text-sm mt-1">Awaiting treasury action</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <Card className="premium-shell lg:col-span-1 border-0 h-fit">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-bold text-lg">Add Funds</h3>
            <Input type="number" placeholder="Enter amount (PKR)" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleDeposit} disabled={loading}>
              <ArrowUpRight className="h-4 w-4 mr-2" /> {loading ? 'Processing...' : 'Deposit Now'}
            </Button>
            <p className="text-xs text-stone-500 text-center">Secure gateway • JazzCash / EasyPaisa / Bank Transfer</p>

            <div className="pt-4 border-t border-stone-200 space-y-3">
              <h4 className="font-semibold text-stone-900">Withdraw Funds</h4>
              <Input type="number" placeholder="Withdrawal amount (PKR)" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
              <Input placeholder="Account title" value={accountTitle} onChange={(e) => setAccountTitle(e.target.value)} />
              <Input placeholder="IBAN (PK...)" value={iban} onChange={(e) => setIban(e.target.value)} />
              <Button variant="outline" className="w-full" onClick={handleWithdraw} disabled={loading}>
                <ArrowDownLeft className="h-4 w-4 mr-2" /> Request Withdrawal
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-shell lg:col-span-2 border-0">
          <CardContent className="p-6">
            <h3 className="font-bold text-lg mb-4">Transaction History</h3>
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <p className="text-stone-500 text-center py-8">No transactions yet</p>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 border border-stone-100 rounded-lg hover:bg-stone-50 transition">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'deposit' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                        {tx.type === 'deposit' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{tx.type.replace('_', ' ')}</p>
                        <p className="text-xs text-stone-500">{formatDate(tx.created_at)}</p>
                      </div>
                    </div>
                    <span className={`font-bold ${tx.type === 'deposit' || tx.type === 'profit_share' ? 'text-green-600' : 'text-stone-900'}`}>
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="premium-shell border-0 mt-8">
        <CardContent className="p-6">
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-emerald-700" /> How Your Money Reaches Farmer</h3>
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-xl bg-white p-3 border border-stone-200">1. You add funds in investor wallet.</div>
            <div className="rounded-xl bg-white p-3 border border-stone-200">2. Investment amount is locked in escrow reserve per livestock.</div>
            <div className="rounded-xl bg-white p-3 border border-stone-200">3. Admin treasury releases staged amounts to farmer wallet on milestones.</div>
            <div className="rounded-xl bg-white p-3 border border-stone-200">4. Sale closes project and profit is distributed transparently.</div>
          </div>

          {withdrawalRequests.length > 0 && (
            <div className="mt-5">
              <h4 className="font-semibold mb-2">Recent Withdrawal Requests</h4>
              <div className="space-y-2">
                {withdrawalRequests.slice(0, 5).map((req) => (
                  <div key={req.id} className="flex items-center justify-between rounded-lg border border-stone-200 p-3 text-sm">
                    <span>{formatCurrency(req.amount)} • {formatDate(req.created_at)}</span>
                    <Badge className={req.status === 'approved' ? 'bg-green-100 text-green-700' : req.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}>
                      {req.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
