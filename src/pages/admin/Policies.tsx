import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'

const sections = [
  {
    title: '1. Farmer Onboarding Policy',
    points: [
      'KYC minimum set: CNIC, selfie with CNIC, bank proof.',
      'Any mismatch in identity fields results in rejection with reason note.',
      'Rejected users can re-apply after corrected document upload.',
    ],
  },
  {
    title: '1.1 Investor Onboarding Policy',
    points: [
      'Investor KYC is mandatory before wallet funding access.',
      'Required files are manually reviewed by admin before approval.',
      'Pending or rejected investor KYC keeps account blocked from investments.',
    ],
  },
  {
    title: '1.2 Admin Identity Policy',
    points: [
      'Admin accounts are role-governed and do not require platform KYC uploads.',
      'Admin access is controlled through internal authorization only.',
      'All admin actions must remain fully auditable.',
    ],
  },
  {
    title: '1.3 Access Security Policy',
    points: [
      '2FA is not required for login in the current operating phase.',
      'Admin access remains limited by admin role, audit logs, and manual approval controls.',
      'Sensitive admin actions must keep documented decision notes where applicable.',
    ],
  },
  {
    title: '2. Project Approval Policy',
    points: [
      'Draft project must include valid cost, share structure, and farmer stake thresholds.',
      'High variance pricing from regional benchmark should be flagged for manual review.',
      'Admin approval moves project to medical review, not directly to active funding.',
      'Project becomes active only after doctor clearance and insurance decision.',
    ],
  },
  {
    title: '2.1 Medical & Insurance Policy',
    points: [
      'Every livestock project needs independent doctor clearance before investor visibility.',
      'City-wise veterinary partners are assigned from the medical operations module.',
      'Medical rejection creates a risk flag and blocks the listing.',
      'Insurance cover is issued after clearance when requested by project terms.',
    ],
  },
  {
    title: '3. Risk & Fraud Policy',
    points: [
      'Pending fraud flags must be resolved within 24 hours.',
      'Repeat suspicious behavior triggers temporary account freeze and escalation.',
      'Critical flags require documented admin decision in audit trail.',
    ],
  },
  {
    title: '4. Sale & Payout Governance',
    points: [
      'Sale requests require evidence verification before approval.',
      'Profit distribution executes after sale approval and status update.',
      'Any payout exception must be logged with ticket/reference id.',
      'Escrow releases and withdrawal requests are controlled in Admin Treasury.',
    ],
  },
  {
    title: '5. Operational SLA',
    points: [
      'KYC decision SLA: 24-48 hours.',
      'Project approval SLA: under 24 hours on complete submission.',
      'Risk flag response SLA: same day.',
    ],
  },
]

export default function AdminPolicies() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-900">Admin Policy Center</h1>
          <p className="text-sm text-stone-600">Operating rules for financing, approvals, risk, and compliance.</p>
        </div>

        <Card className="mb-6 border-0 shadow-sm bg-green-50">
          <CardContent className="p-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-stone-700">
              Live policy document is also available at <code>docs/PLATFORM_POLICY.md</code>.
            </p>
            <Badge variant="success">Governance Active</Badge>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {sections.map((section) => (
            <Card key={section.title} className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>Required administrative controls and decision standards.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-stone-700">
                  {section.points.map((point) => (
                    <li key={point}>- {point}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
