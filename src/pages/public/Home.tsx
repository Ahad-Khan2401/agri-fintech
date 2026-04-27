import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { ArrowRight, CheckCircle, Shield, TrendingUp, Wallet, Stethoscope, Landmark } from 'lucide-react'

export default function Home() {
  const stats = [
    { value: 'PKR 7.8Cr+', label: 'Capital Arranged' },
    { value: '430+', label: 'Operator Farmers' },
    { value: '2,900+', label: 'Animals Financed' },
    { value: '31%', label: 'Avg Scale-Up' },
  ]

  const pillars = [
    { icon: <Wallet className="h-5 w-5" />, title: 'Capital Without Dilution', desc: 'Farmer operator model with investor-funded animal cycles and controlled release of funds.' },
    { icon: <Shield className="h-5 w-5" />, title: 'Risk-Sharing Architecture', desc: 'Vet clearance, insurance, escrow and audit trail reduce platform, farmer and investor risk.' },
    { icon: <TrendingUp className="h-5 w-5" />, title: 'Premium Sale Outcomes', desc: 'Buyer network and pre-sold demand targets better-than-mandi exit pricing.' },
    { icon: <Stethoscope className="h-5 w-5" />, title: 'Medical Dispatch Network', desc: 'City and area based doctors accept inspection tasks like a professional dispatch system.' },
  ]

  const flow = [
    ['01', 'Farmer requests financing', 'Animal cycle, city, area and expected economics are submitted.'],
    ['02', 'Admin screens project', 'KYC, pricing, stake and fraud checks happen before medical review.'],
    ['03', 'Doctor clears animal', 'Nearby verified doctor accepts task and submits medical report.'],
    ['04', 'Investors fund safely', 'Only cleared and insured projects become investor-visible.'],
  ]

  const testimonials = [
    {
      name: 'Haji Imran',
      role: 'Dairy farmer, Sahiwal',
      quote: 'Pehle main 6 janwar se upar nahi ja pa raha tha. Financing request approve hui, doctor inspection bhi hua, aur ab mujhe update dene ka proper system mil gaya.',
      metric: '12 animal cycle',
      image: 'https://images.unsplash.com/photo-1629747490241-624f07d70e1e?w=800&h=900&fit=crop',
      accent: 'Operator Farmer',
    },
    {
      name: 'Ayesha Malik',
      role: 'Investor, Karachi',
      quote: 'Mujhe livestock exposure chahiye tha lekin mandi risk nahi. Vet report, escrow release aur insurance view ne decision much easier kar diya.',
      metric: '4 funded projects',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&h=900&fit=crop',
      accent: 'Private Investor',
    },
    {
      name: 'Rashid Baloch',
      role: 'Operator farmer, Hyderabad',
      quote: 'Buyer ka wait aur cashflow pressure sab se bara masla tha. Platform model me pehle project screen hota hai, phir sale plan clear hota hai.',
      metric: '31% scale-up',
      image: 'https://images.unsplash.com/photo-1595273670150-bd0c3c392e46?w=800&h=900&fit=crop',
      accent: 'Livestock Operator',
    },
  ]

  return (
    <div className="min-h-screen bg-[#0d1514] text-[#f8f1df]">
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1527153857715-3908f2bae5e8?w=1920&h=1200&fit=crop"
            alt="Halal livestock cow farm"
            className="h-full w-full object-cover opacity-18"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_14%,rgba(216,181,109,0.22),transparent_30%),linear-gradient(105deg,#0b1211_0%,rgba(11,18,17,0.98)_52%,rgba(11,18,17,0.9)_100%)]" />
        </div>

        <div className="relative mx-auto grid min-h-[82vh] max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div>
            <Badge className="mb-6 border-[#d8b56d]/30 bg-[#d8b56d]/12 text-[#f0cf83]">
              Farmer Financing + Risk-Sharing Infrastructure
            </Badge>
            <h1 className="max-w-4xl font-serif text-5xl font-bold leading-[0.92] tracking-[-0.045em] sm:text-7xl">
              Livestock capital, built for serious money.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#f8f1df]/88 sm:text-lg">
              MaweshiHub turns farmer operations into professionally screened, medically cleared and escrow-controlled livestock financing cycles.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/signup">
                <Button size="lg" className="h-12 bg-[#d8b56d] px-8 text-[#0d1514] hover:bg-[#f0cf83]">
                  Start Financing <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/listings">
                <Button size="lg" variant="outline" className="h-12 border-[#f8f1df]/18 bg-[#f8f1df]/8 px-8 text-[#f8f1df] hover:bg-[#f8f1df]/14">
                  View Cleared Projects
                </Button>
              </Link>
            </div>
          </div>

          <Card className="border border-[#d8b56d]/28 bg-[#101b19]/92 text-[#f8f1df] shadow-[0_40px_110px_-52px_rgba(0,0,0,0.95)] backdrop-blur-xl">
            <CardContent className="p-6 sm:p-8">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#d8b56d]">Live Control Model</p>
                  <h2 className="mt-2 font-serif text-3xl font-bold">Trust Stack</h2>
                </div>
                <Landmark className="h-8 w-8 text-[#d8b56d]" />
              </div>
              <div className="space-y-4">
                {['Admin KYC review', 'Medical clearance dispatch', 'Insurance policy layer', 'Escrow release governance'].map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-lg border border-[#f8f1df]/10 bg-[#0d1514]/42 px-4 py-3">
                    <span className="text-sm text-[#f8f1df]/95">{item}</span>
                    <CheckCircle className="h-4 w-4 text-[#d8b56d]" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-y border-[#d8b56d]/16 bg-[#101b19]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          {stats.map((stat) => (
            <div key={stat.label} className="px-4 py-8 text-center">
              <p className="font-serif text-3xl font-bold text-[#d8b56d]">{stat.value}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#f8f1df]/82">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#f6f0e4] py-20 text-[#18211f]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#9a7434]">Enterprise Platform</p>
            <h2 className="mt-3 font-serif text-4xl font-bold tracking-tight sm:text-5xl">Not an app. A financing operating system.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {pillars.map((pillar) => (
              <Card key={pillar.title} className="border-0 bg-white/86 shadow-[0_26px_70px_-42px_rgba(23,28,26,0.8)]">
                <CardContent className="p-6">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-[#0d1514] text-[#d8b56d]">{pillar.icon}</div>
                  <h3 className="font-serif text-2xl font-bold">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-700">{pillar.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0b1211] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f0cf83]">Operating Flow</p>
            <h2 className="mt-3 font-serif text-4xl font-bold tracking-tight sm:text-5xl">From animal request to investor-grade asset.</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-4">
            {flow.map(([step, title, desc]) => (
              <Card key={step} className="border border-[#d8b56d]/26 bg-[#121f1c] text-[#f8f1df]">
                <CardContent className="p-6">
                  <p className="mb-8 font-serif text-5xl font-bold text-[#d8b56d]">{step}</p>
                  <h3 className="font-serif text-xl font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#f8f1df]/86">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#111b19] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#d8b56d]">Field Notes</p>
            <h2 className="mt-3 font-serif text-4xl font-bold tracking-tight sm:text-5xl">Realistic feedback from the people this model is built for.</h2>
            <p className="mt-4 text-sm leading-6 text-[#f8f1df]/78">These are representative product testimonials based on current platform workflows: financing, vet clearance, escrow and sale planning.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {testimonials.map((item) => (
              <Card key={item.name} className="group overflow-hidden border border-[#d8b56d]/18 bg-[#f8f1df]/8 text-[#f8f1df]">
                <div className="relative h-64 overflow-hidden">
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1514] via-[#0d1514]/42 to-transparent" />
                  <Badge className="absolute left-4 top-4 bg-[#d8b56d] text-[#0d1514]">{item.accent}</Badge>
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="font-serif text-2xl font-bold">{item.name}</p>
                    <p className="text-xs text-[#f8f1df]/72">{item.role}</p>
                  </div>
                </div>
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center justify-between rounded-lg border border-[#d8b56d]/16 bg-[#0d1514]/36 px-3 py-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-[#d8b56d]">Outcome</span>
                    <span className="text-sm font-semibold">{item.metric}</span>
                  </div>
                  <p className="text-sm leading-7 text-[#f8f1df]/88">"{item.quote}"</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f6f0e4] py-20 text-center text-[#18211f]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-serif text-4xl font-bold tracking-tight sm:text-6xl">
            Scale with performance, not idle capital.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-stone-600">
            Farmers get scale. Investors get structured exposure. Admin gets control. The platform keeps every decision auditable.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/signup">
              <Button size="lg" className="h-12 bg-[#0d1514] px-8 text-[#f8f1df] hover:bg-[#18211f]">
                Create Account <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <CheckCircle className="h-4 w-4 text-[#9a7434]" />
              No upfront platform fee. Profit-linked commission model.
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
