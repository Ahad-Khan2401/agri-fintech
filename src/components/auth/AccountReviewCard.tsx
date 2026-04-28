import { Link } from 'react-router-dom'
import { Clock, ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import type { UserProfile } from '../../store/auth'

export default function AccountReviewCard({ profile }: { profile: UserProfile }) {
  const isRejected = profile.status === 'rejected'
  return (
    <div className="min-h-[70vh] bg-[#f7f2e8] px-4 py-16">
      <Card className="mx-auto max-w-2xl border-0 shadow-[0_28px_90px_-48px_rgba(13,18,23,0.65)]">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            {isRejected ? <ShieldCheck className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
          </div>
          <Badge className={isRejected ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}>
            {isRejected ? 'KYC needs attention' : 'KYC under admin review'}
          </Badge>
          <h1 className="mt-4 text-3xl font-bold text-stone-950">
            {isRejected ? 'Please update your verification' : 'Your account is on hold'}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-600">
            {isRejected
              ? 'Admin could not approve the submitted information. Upload clearer documents or correct your details to continue.'
              : 'You have submitted your profile/KYC information. Until admin approval, investment, wallet, livestock listing and sale functions stay locked for platform safety.'}
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/profile">
              <Button className="bg-green-600 hover:bg-green-700">
                {isRejected ? 'Fix KYC Details' : 'View Submitted Profile'}
              </Button>
            </Link>
            {profile.role === 'farmer' && (
              <Link to="/farmer/kyc">
                <Button variant="outline">KYC Application</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
