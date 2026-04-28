import type { UserProfile } from '../store/auth'

export function getDashboardPath(profile: UserProfile | null | undefined) {
  if (!profile) return '/'
  if (profile.role === 'admin') return '/admin/dashboard'
  if (profile.role === 'farmer') return '/farmer/dashboard'
  return '/investor/dashboard'
}
