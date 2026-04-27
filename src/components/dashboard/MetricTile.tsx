import type { ReactNode } from 'react'
import { Card, CardContent } from '../ui/Card'

type Props = {
  label: string
  value: string
  icon: ReactNode
  tone?: 'emerald' | 'blue' | 'amber' | 'rose' | 'slate'
  subtext?: string
}

const tones = {
  emerald: 'bg-emerald-50 text-emerald-700',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-700',
  slate: 'bg-stone-100 text-stone-700',
}

export default function MetricTile({ label, value, icon, tone = 'slate', subtext }: Props) {
  return (
    <Card className="premium-shell border-0 transition hover:-translate-y-0.5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-stone-600">{label}</p>
            <p className="mt-1 text-2xl font-bold text-stone-950">{value}</p>
            {subtext && <p className="mt-1 text-xs text-stone-500">{subtext}</p>}
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}
