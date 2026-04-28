import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { User, LogOut, LayoutDashboard, Menu, X, Shield, Sprout, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { getDashboardPath } from '../../lib/auth-routing'

export default function Header() {
  const { profile, user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const RoleBadge = () => {
    if (!profile) return null
    if (profile.role === 'admin') return <Badge variant="destructive" className="flex items-center gap-1"><Shield className="h-3 w-3" /> Admin</Badge>
    if (profile.role === 'farmer') return <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1"><Sprout className="h-3 w-3" /> Farmer</Badge>
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Investor</Badge>
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#d8b56d]/25 bg-[#0d1514] shadow-[0_18px_42px_-30px_rgba(0,0,0,0.75)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-[#d8b56d] to-[#886735] rounded-lg flex items-center justify-center shadow-md shadow-black/30">
              <span className="text-[#0d1514] font-black text-sm">MH</span>
            </div>
            <span className="font-bold text-xl text-white hidden sm:block">MaweshiHub</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link to="/listings" className="text-sm text-white/88 hover:text-[#f0cf83] font-medium">Funding Projects</Link>
            <Link to="/doctor/onboard" className="text-sm text-white/88 hover:text-[#f0cf83] font-medium">Doctor Network</Link>
            
            {profile ? (
              <div className="flex items-center gap-4">
                <Link to={getDashboardPath(profile)} className="flex items-center gap-2 rounded-md border border-[#d8b56d]/45 bg-[#d8b56d] px-3 py-2 text-sm font-semibold text-[#0d1514] shadow-sm hover:bg-[#f0cf83]">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
                <div className="flex items-center gap-3 pl-4 border-l border-[#d8b56d]/20">
                  <RoleBadge />
                  <button onClick={() => navigate('/profile')} className="flex items-center gap-2 hover:bg-white/8 rounded-full p-1 pr-3 transition">
                    <div className="w-8 h-8 bg-[#f8f1df]/10 rounded-full flex items-center justify-center border border-[#d8b56d]/25">
                      <User className="h-4 w-4 text-[#d8b56d]" />
                    </div>
                    <span className="text-sm font-medium text-white">
                      {profile.full_name || user?.email?.split('@')[0] || 'User'}
                    </span>
                  </button>
                  <Button variant="ghost" size="sm" onClick={handleLogout} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login"><Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-[#f0cf83]">Sign In</Button></Link>
                <Link to="/signup"><Button size="sm" className="bg-[#d8b56d] text-[#0d1514] hover:bg-[#f0cf83]">Get Started</Button></Link>
              </div>
            )}
          </div>

          <button className="md:hidden p-2 text-[#f8f1df]" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[#d8b56d]/20 bg-[#0d1514] px-4 py-4 space-y-3">
          <Link to="/listings" className="block text-[#f8f1df]/80 font-medium" onClick={() => setMobileOpen(false)}>Funding Projects</Link>
          <Link to="/doctor/onboard" className="block text-[#f8f1df]/80 font-medium" onClick={() => setMobileOpen(false)}>Doctor Network</Link>
          {profile ? (
            <>
              <Link to={getDashboardPath(profile)} className="block rounded-md bg-[#d8b56d] px-3 py-2 font-semibold text-[#0d1514]" onClick={() => setMobileOpen(false)}>Dashboard</Link>
              <Link to="/profile" className="block text-[#f8f1df]/80 font-medium" onClick={() => setMobileOpen(false)}>Profile</Link>
              <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="block w-full text-left text-rose-600 font-medium">Logout</button>
              <RoleBadge />
            </>
          ) : (
            <>
              <Link to="/login" className="block text-[#f8f1df]/80 font-medium" onClick={() => setMobileOpen(false)}>Sign In</Link>
              <Link to="/signup" className="block" onClick={() => setMobileOpen(false)}>
                <Button className="w-full bg-[#d8b56d] text-[#0d1514] hover:bg-[#f0cf83]">Get Started</Button>
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}
