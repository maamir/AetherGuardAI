import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  DollarSign, 
  BarChart3, 
  FileText, 
  Shield, 
  Activity,
  TrendingUp,
  Building,
  Users,
  Database,
  LogOut,
  Settings,
  Key,
  Server
} from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/realtime', icon: Activity, label: 'Real-Time' },
    { path: '/advanced-analytics', icon: TrendingUp, label: 'Advanced Analytics' },
    { path: '/budgets', icon: DollarSign, label: 'Budgets' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/audit', icon: FileText, label: 'Audit Logs' },
    { path: '/policies', icon: Shield, label: 'Policies' },
    { path: '/llm-providers', icon: Server, label: 'LLM Providers' },
    { path: '/models', icon: Database, label: 'Models' },
    { path: '/tenants', icon: Building, label: 'Tenants' },
    { path: '/users', icon: Users, label: 'Users' },
    { path: '/api-keys', icon: Key, label: 'API Keys' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Sidebar */}
      <aside style={{
        width: '250px',
        background: '#1e293b',
        borderRight: '1px solid #334155',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#60a5fa' }}>
            AetherGuard AI
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Control Portal
          </p>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto' }}>
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
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#334155'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User Section */}
        <div style={{ 
          borderTop: '1px solid #334155', 
          paddingTop: '1rem',
          marginTop: '1rem'
        }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              width: '100%',
              border: 'none',
              background: 'transparent',
              color: '#cbd5e1',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#334155'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
