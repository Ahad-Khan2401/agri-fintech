import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { User, LayoutDashboard, Menu, X, Shield, Sprout, TrendingUp, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export default function Header() {
  const { profile, user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const getDashboardPath = () => {
    if (!profile) return '/'
    if (profile.role === 'admin') return '/admin'
    if (profile.role === 'farmer') return '/farmer'
    return '/investor'
  }

  const RoleBadge = () => {
    if (!profile) return null
    if (profile.role === 'admin') return <Badge variant="destructive" className="flex items-center gap-1"><Shield className="h-3 w-3" /> Admin</Badge>
    if (profile.role === 'farmer') return <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1"><Sprout className="h-3 w-3" /> Farmer</Badge>
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Investor</Badge>
  }

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-stone-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="font-bold text-xl text-stone-900 hidden sm:block">MaweshiHub</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/listings" className="text-sm text-stone-600 hover:text-stone-900 font-medium">Browse Livestock</Link>
            
            {profile ? (
              <div className="flex items-center gap-4">
                <Link to={getDashboardPath()} className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 font-medium">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
                
                {/* Profile Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 hover:bg-stone-100 rounded-full p-1 pr-3 transition"
                  >
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-green-700" />
                    </div>
                    <span className="text-sm font-medium text-stone-700">
                      {profile.full_name || user?.email?.split('@')[0] || 'User'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-stone-500" />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-stone-200 py-1 z-50">
                      <Link
                        to="/profile"
                        className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                        onClick={() => setDropdownOpen(false)}
                      >
                        Profile & Settings
                      </Link>
                      <button
                        onClick={() => { handleLogout(); setDropdownOpen(false); }}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-stone-50"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login"><Button variant="ghost" size="sm">Sign In</Button></Link>
                <Link to="/signup"><Button size="sm" className="bg-green-600 hover:bg-green-700">Get Started</Button></Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-stone-200 bg-white px-4 py-4 space-y-3">
          <Link to="/listings" className="block text-stone-600 font-medium" onClick={() => setMobileOpen(false)}>Browse Livestock</Link>
          {profile ? (
            <>
              <Link to={getDashboardPath()} className="block text-stone-600 font-medium" onClick={() => setMobileOpen(false)}>Dashboard</Link>
              <Link to="/profile" className="block text-stone-600 font-medium" onClick={() => setMobileOpen(false)}>Profile</Link>
              <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="block w-full text-left text-red-600 font-medium">Logout</button>
              <RoleBadge />
            </>
          ) : (
            <>
              <Link to="/login" className="block text-stone-600 font-medium" onClick={() => setMobileOpen(false)}>Sign In</Link>
              <Link to="/signup" className="block" onClick={() => setMobileOpen(false)}>
                <Button className="w-full bg-green-600 hover:bg-green-700">Get Started</Button>
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}
