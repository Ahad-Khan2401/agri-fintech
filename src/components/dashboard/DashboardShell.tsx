import type { ReactNode } from 'react'
import { Badge } from '../ui/Badge'

type Props = {
  label: string
  title: string
  description: string
  actions?: ReactNode
  side?: ReactNode
  children: ReactNode
}

export default function DashboardShell({ label, title, description, actions, side, children }: Props) {
  return (
    <div className="enterprise-page">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="enterprise-hero mb-6">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.25fr_0.75fr] lg:p-10">
            <div>
              <Badge className="mb-5 bg-amber-300/15 text-amber-100 border border-amber-200/20">{label}</Badge>
              <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-5xl">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/75">{description}</p>
              {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
            </div>
            {side && <div className="rounded-lg border border-white/10 bg-white/8 p-5">{side}</div>}
          </div>
        </section>
        {children}
      </main>
    </div>
  )
}
