import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/Dialog'
import { formatDate } from '../../lib/utils'
import { Download, Eye, Loader2, Search } from 'lucide-react'

export default function AdminAudit() {
  const [logs, setLogs] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200)
      setLogs(data || [])
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => logs.filter((l) => {
    const q = search.toLowerCase()
    return (
      (l.action || '').toLowerCase().includes(q) ||
      (l.target_table || '').toLowerCase().includes(q) ||
      (l.target_id || '').toLowerCase().includes(q)
    )
  }), [logs, search])

  const exportCsv = () => {
    const headers = ['time', 'actor_id', 'action', 'target_table', 'target_id']
    const rows = filtered.map((l) => [l.created_at, l.actor_id || '', l.action || '', l.target_table || '', l.target_id || ''])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `admin_audit_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-900">Audit & Compliance Trail</h1>
          <p className="text-sm text-stone-600">Immutable event history for governance and investigation.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <Stat label="Total Records" value={logs.length.toString()} />
          <Stat label="Today Events" value={logs.filter((l) => new Date(l.created_at).toDateString() === new Date().toDateString()).length.toString()} />
          <Stat label="Filtered View" value={filtered.length.toString()} />
        </div>

        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative max-w-sm w-full">
              <Search className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input className="pl-10" placeholder="Search by action/table/id..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Actions</CardTitle>
            <CardDescription>Last 200 actions captured from operational workflows.</CardDescription>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-stone-500">No logs match this filter.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Inspect</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{formatDate(l.created_at)}</TableCell>
                      <TableCell><Badge variant="outline">{l.action || 'unknown'}</Badge></TableCell>
                      <TableCell>{l.target_table || '-'} / {(l.target_id || '-').slice(0, 8)}</TableCell>
                      <TableCell>{(l.actor_id || '-').slice(0, 8)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => setSelected(l)}>
                          <Eye className="h-4 w-4 mr-1" /> Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Audit Event Details</DialogTitle>
            <DialogDescription>Complete payload for review and compliance archive.</DialogDescription>
          </DialogHeader>
          {selected && (
            <pre className="max-h-[60vh] overflow-auto rounded-lg bg-stone-100 p-3 text-xs">
              {JSON.stringify(selected, null, 2)}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <p className="text-sm text-stone-600">{label}</p>
        <p className="text-2xl font-bold text-stone-900">{value}</p>
      </CardContent>
    </Card>
  )
}
