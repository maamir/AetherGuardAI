import { useQuery } from '@tanstack/react-query'
import { Users, Activity, AlertTriangle, TrendingUp } from 'lucide-react'
import { adminApi } from '../services/api'

interface SystemMetrics {
  totalTenants: number
  activeTenants: number
  totalRequests: number
  securityEvents: number
}

export default function Dashboard() {
  const { data: metrics, isLoading } = useQuery<SystemMetrics>({
    queryKey: ['system-metrics'],
    queryFn: () => adminApi.getSystemMetrics(),
  })

  const stats = [
    {
      label: 'Total Tenants',
      value: isLoading ? '...' : metrics?.totalTenants || 0,
      icon: Users,
      color: '#60a5fa',
    },
    {
      label: 'Active Tenants',
      value: isLoading ? '...' : metrics?.activeTenants || 0,
      icon: Activity,
      color: '#10b981',
    },
    {
      label: 'Total Requests',
      value: isLoading ? '...' : (metrics?.totalRequests || 0).toLocaleString(),
      icon: TrendingUp,
      color: '#f59e0b',
    },
    {
      label: 'Security Events',
      value: isLoading ? '...' : (metrics?.securityEvents || 0).toLocaleString(),
      icon: AlertTriangle,
      color: '#ef4444',
    },
  ]

  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
        System Dashboard
      </h1>

      {/* Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              style={{
                background: '#1e293b',
                padding: '1.5rem',
                borderRadius: '0.75rem',
                border: '1px solid #334155',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    {stat.label}
                  </p>
                  <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                    {stat.value}
                  </p>
                </div>
                <div
                  style={{
                    background: `${stat.color}20`,
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                  }}
                >
                  <Icon size={24} color={stat.color} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div
        style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Quick Actions
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <a
            href="/tenants"
            style={{
              padding: '1rem',
              background: '#334155',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              color: '#e2e8f0',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#475569')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#334155')}
          >
            Manage Tenants
          </a>
          <a
            href="/analytics"
            style={{
              padding: '1rem',
              background: '#334155',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              color: '#e2e8f0',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#475569')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#334155')}
          >
            View Analytics
          </a>
          <a
            href="/audit-logs"
            style={{
              padding: '1rem',
              background: '#334155',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              color: '#e2e8f0',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#475569')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#334155')}
          >
            View Audit Logs
          </a>
        </div>
      </div>
    </div>
  )
}
