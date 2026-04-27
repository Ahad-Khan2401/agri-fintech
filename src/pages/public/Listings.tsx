import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Card, CardContent } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { formatCurrency } from '../../lib/utils'
import { Search, MapPin, Weight, TrendingUp, Shield, Stethoscope, ArrowRight, CheckCircle } from 'lucide-react'

const fallbackAnimalImages = [
  'https://images.unsplash.com/photo-1500595046743-ddf4d3d753fd?w=900&h=650&fit=crop',
  'https://images.unsplash.com/photo-1527153857715-3908f2bae5e8?w=900&h=650&fit=crop',
  'https://images.unsplash.com/photo-1524024973431-2ad916746881?w=900&h=650&fit=crop',
]

export default function Listings() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterBreed, setFilterBreed] = useState('')

  useEffect(() => {
    loadListings()
  }, [])

  const loadListings = async () => {
    const { data, error } = await supabase
      .from('livestock')
      .select('*, farmer:profiles(phone), vet_reports(*), insurance_policies(*)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    
    if (!error) setItems(data || [])
    setLoading(false)
  }

  const filtered = items.filter(l => 
    l.title.toLowerCase().includes(search.toLowerCase()) &&
    (!filterBreed || l.breed === filterBreed)
  )

  return (
    <div className="min-h-screen bg-[#0d1514] text-[#f8f1df]">
      <section className="border-b border-[#d8b56d]/16 bg-[radial-gradient(circle_at_82%_10%,rgba(216,181,109,0.18),transparent_32%),linear-gradient(135deg,#0d1514_0%,#111c1a_100%)]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <Badge className="mb-5 border-[#d8b56d]/30 bg-[#d8b56d]/12 text-[#f0cf83]">Vet-cleared marketplace</Badge>
          <div className="grid gap-8 lg:grid-cols-[1fr_0.75fr] lg:items-end">
            <div>
              <h1 className="font-serif text-5xl font-bold tracking-tight sm:text-6xl">Listed livestock, professionally screened.</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#f8f1df]/82">
                Active projects become visible only after admin review, medical clearance and insurance controls. No random mandi listings.
              </p>
            </div>
            <Card className="border border-[#d8b56d]/20 bg-[#f8f1df]/8 text-[#f8f1df] backdrop-blur">
              <CardContent className="space-y-3 p-5 text-sm">
                <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#d8b56d]" /> Farmer KYC checked</div>
                <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#d8b56d]" /> Doctor report required</div>
                <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#d8b56d]" /> Escrow-controlled funding</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-lg border border-[#d8b56d]/16 bg-[#f8f1df]/7 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d8b56d]">Active Funding Projects</p>
            <p className="mt-1 text-sm text-[#f8f1df]/72">Search halal livestock assets by breed, title and location.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#d8b56d]" />
            <input 
              type="text" 
              placeholder="Search by name..." 
              className="w-full rounded-lg border border-[#d8b56d]/18 bg-[#0d1514] py-2 pl-10 pr-4 text-sm text-[#f8f1df] placeholder:text-[#f8f1df]/45 focus:outline-none focus:ring-2 focus:ring-[#d8b56d]"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="rounded-lg border border-[#d8b56d]/18 bg-[#0d1514] px-4 py-2 text-sm text-[#f8f1df] focus:outline-none focus:ring-2 focus:ring-[#d8b56d]"
            value={filterBreed}
            onChange={e => setFilterBreed(e.target.value)}
          >
            <option value="">All Breeds</option>
            <option value="Sahiwal">Sahiwal</option>
            <option value="Cholistani">Cholistani</option>
            <option value="Nili-Ravi">Nili-Ravi</option>
            <option value="Kundhi">Kundhi</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-80 animate-pulse rounded-lg bg-[#f8f1df]/8" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border border-[#d8b56d]/16 bg-[#f8f1df]/7 p-12 text-center text-[#f8f1df]">
          <p>No projects match your filters.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((l, index) => (
            <Link to={`/livestock/${l.id}`} key={l.id} className="group">
              <Card className="flex h-full flex-col overflow-hidden border border-[#d8b56d]/16 bg-[#f7efe0] text-[#18211f] shadow-[0_34px_90px_-56px_rgba(0,0,0,0.95)] transition group-hover:-translate-y-1 group-hover:border-[#d8b56d]/45">
                <div className="h-52 bg-stone-200 relative overflow-hidden">
                  <img
                    src={l.media_urls?.[0] || fallbackAnimalImages[index % fallbackAnimalImages.length]}
                    alt={l.title || 'Halal livestock'}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/58 via-black/8 to-transparent" />
                  <span className="absolute top-3 right-3">
                    <Badge className="bg-[#d8b56d] text-[#0d1514]">{l.breed || 'Mixed'}</Badge>
                  </span>
                  <span className="absolute bottom-3 left-3 flex gap-2">
                    {l.vet_reports?.some((r: any) => r.status === 'approved') && (
                      <Badge className="bg-emerald-700 text-white"><Stethoscope className="h-3 w-3 mr-1" /> Vet cleared</Badge>
                    )}
                    {l.insurance_policies?.some((p: any) => p.status === 'active') && (
                      <Badge className="bg-[#0d1514] text-[#f8f1df]"><Shield className="h-3 w-3 mr-1" /> Insured</Badge>
                    )}
                  </span>
                </div>
                <CardContent className="p-5 flex-1 flex flex-col">
                  <h3 className="font-serif text-2xl font-bold text-[#18211f] mb-1 group-hover:text-[#8a6327] transition">{l.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-stone-700 mb-3">
                    <MapPin className="h-4 w-4" /> {l.location?.city || l.location_city || 'Pakistan'}{l.area ? `, ${l.area}` : ''}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div className="flex items-center gap-2 text-stone-700">
                      <Weight className="h-4 w-4" /> {l.weight_kg} kg
                    </div>
                    <div className="flex items-center gap-2 text-stone-700">
                      <TrendingUp className="h-4 w-4" /> {l.shares_available} left
                    </div>
                  </div>
                  <div className="mt-auto pt-4 border-t border-[#d8b56d]/20 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-stone-500">Funding per share</p>
                      <p className="font-bold text-[#8a6327]">{formatCurrency(l.price_per_share)}</p>
                    </div>
                    <Button size="sm" className="bg-[#0d1514] text-[#f8f1df] hover:bg-[#18211f]">View <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      </main>
    </div>
  )
}
