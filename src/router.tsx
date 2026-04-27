import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './store/auth'
import { ReactNode, useEffect } from 'react'
import Header from './components/layout/Header'

// PUBLIC PAGES
import Home from './pages/public/Home'
import Listings from './pages/public/Listings'
import LivestockDetail from './pages/public/LivestockDetail'
import DoctorOnboarding from './pages/doctor/Onboarding'
import DoctorTaskBoard from './pages/doctor/TaskBoard'

// AUTH PAGES
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import ForgotPassword from './pages/auth/ForgotPassword'

// INVESTOR PAGES
import InvestorDashboard from './pages/investor/Dashboard'
import InvestorWallet from './pages/investor/Wallet'
import InvestorInvestments from './pages/investor/Investments'

// FARMER PAGES
import FarmerDashboard from './pages/farmer/Dashboard'
import FarmerAddLivestock from './pages/farmer/AddLivestock'
import FarmerUpdates from './pages/farmer/Updates'
import KYCVerification from './pages/farmer/KYCVerification'
import VetReport from './pages/farmer/VetReport'
import FarmerWallet from './pages/farmer/Wallet'

// ADMIN PAGES
import AdminDashboard from './pages/admin/Dashboard'
import AdminApprovals from './pages/admin/Approvals'
import AdminAudit from './pages/admin/Audit'
import AdminPolicies from './pages/admin/Policies'
import AdminTreasury from './pages/admin/Treasury'
import AdminMedicalOps from './pages/admin/MedicalOps'

// PROFILE
import ProfileSettings from './pages/profile/Settings'

type RoleType = 'investor' | 'farmer' | 'admin'

// Layout component that includes Header
const Layout = () => {
  // Load auth on mount
  useEffect(() => {
    useAuth.getState().load()
  }, [])
  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

// Protected Route
const RequireAuth = ({ allowedRoles }: { allowedRoles: RoleType[] }) => {
  const { profile, isLoading } = useAuth()
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div></div>
  if (!profile) return <Navigate to="/login" replace />
  if (!allowedRoles.includes(profile.role as RoleType)) return <Navigate to="/" replace />
  return <Outlet />
}

// Farmer Guard
const FarmerGuard = ({ children }: { children: ReactNode }) => {
  const { profile, isLoading } = useAuth()
  if (isLoading) return null
  if (!profile || profile.role !== 'farmer') return <Navigate to="/" replace />
  if (profile.status !== 'approved') return <Navigate to="/farmer/kyc" replace />
  return <>{children}</>
}

// Admin Guard
const AdminGuard = ({ children }: { children: ReactNode }) => {
  const { profile, isLoading } = useAuth()
  if (isLoading) return null
  if (!profile || profile.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/listings', element: <Listings /> },
      { path: '/livestock/:id', element: <LivestockDetail /> },
      { path: '/terms', element: <div className="p-8">Terms</div> },
      { path: '/risk', element: <div className="p-8">Risk Disclosure</div> },
      { path: '/doctor/onboard', element: <DoctorOnboarding /> },
      { path: '/doctor/tasks', element: <DoctorTaskBoard /> },
      { path: '/login', element: <Login /> },
      { path: '/signup', element: <Signup /> },
      { path: '/forgot-password', element: <ForgotPassword /> },
      // Investor routes
      {
        path: '/investor',
        element: <RequireAuth allowedRoles={['investor']} />,
        children: [
          { index: true, element: <Navigate to="/investor/dashboard" replace /> },
          { path: 'dashboard', element: <InvestorDashboard /> },
          { path: 'wallet', element: <InvestorWallet /> },
          { path: 'investments', element: <InvestorInvestments /> },
        ]
      },
      
      // Farmer routes
      {
        path: '/farmer',
        element: <RequireAuth allowedRoles={['farmer']} />,
        children: [
          { index: true, element: <FarmerGuard><FarmerDashboard /></FarmerGuard> },
          { path: 'dashboard', element: <FarmerGuard><FarmerDashboard /></FarmerGuard> },
          { path: 'kyc', element: <KYCVerification /> },
          { path: 'add', element: <FarmerGuard><FarmerAddLivestock /></FarmerGuard> },
          { path: 'wallet', element: <FarmerGuard><FarmerWallet /></FarmerGuard> },
          { path: 'livestock/:id/updates', element: <FarmerGuard><FarmerUpdates /></FarmerGuard> },
          { path: 'livestock/:id/vet-report', element: <FarmerGuard><VetReport /></FarmerGuard> },
        ]
      },
      
      // Admin routes
      {
        path: '/admin',
        element: <RequireAuth allowedRoles={['admin']} />,
        children: [
          { index: true, element: <AdminGuard><AdminDashboard /></AdminGuard> },
          { path: 'dashboard', element: <AdminGuard><AdminDashboard /></AdminGuard> },
          { path: 'approvals', element: <AdminGuard><AdminApprovals /></AdminGuard> },
          { path: 'medical', element: <AdminGuard><AdminMedicalOps /></AdminGuard> },
          { path: 'treasury', element: <AdminGuard><AdminTreasury /></AdminGuard> },
          { path: 'audit', element: <AdminGuard><AdminAudit /></AdminGuard> },
          { path: 'policies', element: <AdminGuard><AdminPolicies /></AdminGuard> },
        ]
      },
      
      // Profile
      {
        path: '/profile',
        element: <RequireAuth allowedRoles={['investor', 'farmer', 'admin']} />,
        children: [
          { index: true, element: <ProfileSettings /> },
        ]
      },
      
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  }
])
