import { useQuery } from '@tanstack/react-query'
import { Activity, DollarSign, Clock, Server } from 'lucide-react'
import { api } from '../services/api'

interface ApiKeyUsageProps {
  apiKeyId: string
  timeRange?: number // days
}

export default function ApiKeyUsage({ apiKeyId, timeRange = 7 }: ApiKeyUsageProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['api-key-stats', apiKeyId, timeRange],
    queryFn: () => api.getApiKeyStats(apiKeyId, timeRange),
  })

  if (isLoading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Loading usage...</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No usage data</p>
      </div>
    )
  }

  const usageItems = [
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
      label: 'Top Provider',
      value: stats.top_provider || 'N/A',
      icon: Server,
      color: '#a78bfa',
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        {usageItems.map((item) => {
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

      {stats.last_used && (
        <div style={{ padding: '0.75rem', background: '#0f172a', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
          <span style={{ color: '#94a3b8' }}>Last used: </span>
          <span style={{ color: '#e2e8f0' }}>
            {new Date(stats.last_used).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}
