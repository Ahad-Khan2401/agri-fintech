type SeriesPoint = {
  label: string
  value: number
}

export function Sparkline({ data, stroke = '#0f8f68' }: { data: SeriesPoint[]; stroke?: string }) {
  const max = Math.max(...data.map((item) => item.value), 1)
  const points = data
    .map((item, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 100
      const y = 48 - (item.value / max) * 42
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg viewBox="0 0 100 52" className="h-24 w-full overflow-visible">
      <defs>
        <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,52 ${points} 100,52`} fill="url(#sparkFill)" />
    </svg>
  )
}

export function AllocationBars({ data }: { data: SeriesPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1
  return (
    <div className="space-y-3">
      {data.map((item) => {
        const pct = Math.round((item.value / total) * 100)
        return (
          <div key={item.label}>
            <div className="mb-1 flex justify-between text-xs text-stone-600">
              <span>{item.label}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-stone-100">
              <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
