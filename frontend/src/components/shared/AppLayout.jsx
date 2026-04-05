import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Upload, Shield, Bell, Settings,
  Sun, Moon, LogOut, Menu, X, ChevronRight, Zap,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/dashboard', label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/upload',    label: 'Upload Asset', icon: Upload },
]

export default function AppLayout() {
  const { user, logout }    = useAuth()
  const { isDark, toggle }  = useTheme()
  const navigate            = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const onChange = (event) => {
      setIsDesktop(event.matches)
      setSidebarOpen(event.matches)
    }

    setSidebarOpen(media.matches)

    if (media.addEventListener) media.addEventListener('change', onChange)
    else media.addListener(onChange)

    return () => {
      if (media.removeEventListener) media.removeEventListener('change', onChange)
      else media.removeListener(onChange)
    }
  }, [])

  const handleLogout = async () => {
    await logout()
    toast.success('Signed out')
    navigate('/login')
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User'
  const avatar = user?.photoURL

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Mobile overlay ── */}
      <AnimatePresence>
        {!isDesktop && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 md:hidden"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <motion.aside
        initial={false}
        animate={{ x: isDesktop || sidebarOpen ? 0 : -280 }}
        className="fixed md:relative md:translate-x-0 z-30 flex flex-col h-full w-64 flex-shrink-0"
        style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3d6aff, #8b5cf6)' }}>
            <Shield size={16} color="white" />
          </div>
          <span className="font-display font-700 text-lg" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            AssetShield AI
          </span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-mono"
            style={{ background: 'rgba(61,106,255,0.12)', color: '#60a5fa', border: '1px solid rgba(61,106,255,0.2)' }}>
            MVP
          </span>
          <button className="md:hidden ml-1" onClick={() => setSidebarOpen(false)}>
            <X size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 py-2 text-xs font-600 uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
            Navigation
          </p>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={17} />
              <span>{label}</span>
              <ChevronRight size={14} className="ml-auto opacity-30" />
            </NavLink>
          ))}

          <div className="pt-4">
            <p className="px-3 py-2 text-xs font-600 uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
              System
            </p>
            <button className="sidebar-item w-full" onClick={toggle}>
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
              <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </div>
        </nav>

        {/* User card */}
        <div className="px-3 pb-4" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-card)' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#3d6aff,#8b5cf6)', color: 'white' }}>
              {avatar
                ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                : displayName[0].toUpperCase()
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-600 truncate" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{displayName}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
            </div>
            <button onClick={handleLogout} title="Sign out"
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.target.style.color = 'var(--danger)'}
              onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <div className="flex md:hidden items-center gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <button onClick={() => setSidebarOpen(true)}>
            <Menu size={22} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={18} style={{ color: 'var(--accent)' }} />
            <span className="font-display font-700" style={{ fontWeight: 700 }}>AssetShield AI</span>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
    </div>
  )
}
