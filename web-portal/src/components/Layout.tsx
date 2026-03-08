import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, DollarSign, BarChart3, FileText, Shield } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/budgets', icon: DollarSign, label: 'Budgets' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/audit', icon: FileText, label: 'Audit Logs' },
    { path: '/policies', icon: Shield, label: 'Policies' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: '250px',
        background: '#1e293b',
        borderRight: '1px solid #334155',
        padding: '1.5rem',
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#60a5fa' }}>
            AetherGuard AI
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Control Portal
          </p>
        </div>

        <nav>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  marginBottom: '0.5rem',
                  textDecoration: 'none',
                  color: isActive ? '#60a5fa' : '#cbd5e1',
                  background: isActive ? '#1e40af20' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
