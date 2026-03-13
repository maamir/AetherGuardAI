import { useQuery } from '@tanstack/react-query'
import { Activity, DollarSign, Clock, AlertCircle } from 'lucide-react'
import { api } from '../services/api'

interface ProviderStatsProps {
  providerId: string
  timeRange?: number // days
}

export default function ProviderStats({ providerId, timeRange = 7 }: ProviderStatsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['provider-stats', providerId, timeRange],
    queryFn: () => api.getProviderStats(providerId, timeRange),
  })

  if (isLoading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Loading stats...</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No data available</p>
      </div>
    )
  }

  const statItems = [
    {
      label: 'Total Requests',
      value: stats.total_requests?.toLocaleString() || '0',
      icon: Activity,
      color: '#60a5fa',
    },
    {
      label: 'Total Cost',
      value: `$${(stats.total_cost || 0).toFixed(2)}`,
      icon: DollarSign,
      color: '#34d399',
    },
    {
      label: 'Avg Latency',
      value: `${stats.avg_latency || 0}ms`,
      icon: Clock,
      color: '#fbbf24',
    },
    {
      label: 'Error Rate',
      value: `${((stats.error_rate || 0) * 100).toFixed(1)}%`,
      icon: AlertCircle,
      color: stats.error_rate > 0.05 ? '#ef4444' : '#10b981',
    },
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem',
      }}
    >
      {statItems.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            style={{
              padding: '1rem',
              background: '#0f172a',
              borderRadius: '0.5rem',
              border: '1px solid #1e293b',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Icon size={16} color={item.color} />
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {item.label}
              </p>
            </div>
            <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: item.color }}>
              {item.value}
            </p>
          </div>
        )
      })}
    </div>
  )
}
