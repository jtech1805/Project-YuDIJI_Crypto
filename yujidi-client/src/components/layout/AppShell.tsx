import { Activity, FileText, LayoutDashboard, LogOut, Radar } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/setup-monitor', label: 'Setup Monitor', icon: Radar },
  { to: '/report', label: 'Detailed Report', icon: FileText },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-100">
      <header className="border-b border-gray-800 bg-black/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-400" />
            <span className="font-semibold tracking-wide text-purple-300">
              Project YuJiDi
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-2">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition ${
                      isActive
                        ? 'border-purple-500/70 bg-purple-500/10 text-purple-200'
                        : 'border-gray-800 text-gray-300 hover:border-gray-700 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex items-center gap-2 rounded-md border border-gray-800 px-3 py-1.5 text-sm text-gray-300 transition hover:border-green-500/50 hover:text-green-300"
            >
              <LogOut className="h-4 w-4" />
              {user?.email ?? 'Logout'}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}
