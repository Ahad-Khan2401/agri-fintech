import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/auth'
import { Card, CardContent } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { formatCurrency, formatDate } from '../../lib/utils'
import { TrendingUp, Clock, CheckCircle } from 'lucide-react'

export default function Investments() {
  const { profile } = useAuth()
  const [investments, setInvestments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) {
      supabase.from('investments')
        .select('*, livestock:livestock(*), livestock_updates(*)')
        .eq('investor_id', profile.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => { setInvestments(data || []); setLoading(false) })
    }
  }, [profile])

  if (loading) return <div className="p-12 text-center">Loading portfolio...</div>

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-stone-900 mb-8">My Funded Projects</h1>
      
      {investments.length === 0 ? (
        <Card className="border-0 shadow-sm p-12 text-center">
          <TrendingUp className="h-12 w-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">No active project funding yet</h3>
          <p className="text-stone-600 mb-6">Start your halal farmer-financing journey today.</p>
          <Link to="/listings"><Button className="bg-green-600 hover:bg-green-700">Explore Projects</Button></Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {investments.map(inv => (
            <Card key={inv.id} className="border-0 shadow-sm hover:shadow-md transition">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-stone-200 rounded-lg flex items-center justify-center text-xs text-stone-400">Img</div>
                    <div>
                      <h3 className="font-bold text-lg">{inv.livestock?.title}</h3>
                      <p className="text-sm text-stone-600">{inv.livestock?.breed} • {inv.livestock?.weight_kg}kg</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant={inv.livestock?.status === 'sold' ? 'success' : inv.livestock?.status === 'loss' ? 'destructive' : 'default'} className="capitalize">
                          {inv.livestock?.status}
                        </Badge>
                        <span className="text-xs text-stone-500 flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(inv.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-lg font-bold text-stone-900">{formatCurrency(inv.amount)}</p>
                    <p className="text-sm text-stone-600">{inv.shares} shares • {inv.ownership_percent}% ownership</p>
                    <Link to={`/livestock/${inv.livestock_id}`}><Button variant="outline" size="sm">View Details</Button></Link>
                  </div>
                </div>
                {inv.livestock_updates?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-stone-100">
                    <p className="text-xs font-semibold text-stone-500 uppercase mb-2">Latest Update</p>
                    <div className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <p className="text-stone-700">{inv.livestock_updates[0].notes || `Health: ${inv.livestock_updates[0].health_status}`}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
