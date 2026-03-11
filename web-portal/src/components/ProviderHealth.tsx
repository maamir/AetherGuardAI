import { Activity, AlertTriangle, TrendingUp, Clock } from 'lucide-react'

export interface ProviderHealthMetrics {
  providerId: string
  providerName: string
  status: 'online' | 'offline' | 'degraded'
  responseTime: number // milliseconds
  errorRate: number // percentage
  uptime: number // percentage
  lastChecked: string
  requestsPerMinute: number
  averageLatency: number
}

export interface ProviderHealthProps {
  metrics: ProviderHealthMetrics[]
  isLoading?: boolean
  onRefresh?: () => void
}

export default function ProviderHealth({ metrics = [], isLoading = false, onRefresh }: ProviderHealthProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return { bg: '#10b98120', text: '#10b981', label: 'Online' }
      case 'offline':
        return { bg: '#ef444420', text: '#ef4444', label: 'Offline' }
      case 'degraded':
        return { bg: '#f59e0b20', text: '#f59e0b', label: 'Degraded' }
      default:
        return { bg: '#94a3b820', text: '#94a3b8', label: 'Unknown' }
    }
  }

  const getHealthScore = (metric: ProviderHealthMetrics) => {
    // Calculate health score based on uptime, error rate, and response time
    let score = 100
    score -= metric.errorRate * 0.5 // Error rate impact
    score -= (metric.responseTime / 100) * 0.3 // Response time impact (max 30 points)
    score -= (100 - metric.uptime) * 0.2 // Uptime impact
    return Math.max(0, Math.min(100, score))
  }

  const getHealthColor = (score: number) => {
    if (score >= 90) return '#10b981' // Green
    if (score >= 70) return '#f59e0b' // Amber
    return '#ef4444' // Red
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Provider Health</h2>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            style={{
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
      </div>

      {isLoading ? (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
            color: '#94a3b8',
          }}
        >
          Loading health metrics...
        </div>
      ) : metrics.length === 0 ? (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            background: '#1e293b',
            border: '1px dashed #334155',
            borderRadius: '0.5rem',
            color: '#94a3b8',
          }}
        >
          No providers configured
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {metrics.map((metric) => {
            const statusColor = getStatusColor(metric.status)
            const healthScore = getHealthScore(metric)
            const healthColor = getHealthColor(healthScore)

            return (
              <div
                key={metric.providerId}
                style={{
                  padding: '1rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '0.25rem' }}>
                      {metric.providerName}
                    </h3>
                    <div
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        background: statusColor.bg,
                        color: statusColor.text,
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                      }}
                    >
                      {statusColor.label}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      background: `${healthColor}20`,
                      border: `2px solid ${healthColor}`,
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: healthColor }}>
                      {Math.round(healthScore)}%
                    </span>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  {/* Response Time */}
                  <div
                    style={{
                      padding: '0.75rem',
                      background: '#0f172a',
                      borderRadius: '0.375rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <Clock size={14} color="#94a3b8" />
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Response Time</span>
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#e2e8f0' }}>
                      {metric.responseTime}ms
                    </div>
                  </div>

                  {/* Error Rate */}
                  <div
                    style={{
                      padding: '0.75rem',
                      background: '#0f172a',
                      borderRadius: '0.375rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <AlertTriangle size={14} color={metric.errorRate > 5 ? '#ef4444' : '#94a3b8'} />
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Error Rate</span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: metric.errorRate > 5 ? '#ef4444' : '#e2e8f0',
                      }}
                    >
                      {metric.errorRate.toFixed(2)}%
                    </div>
                  </div>

                  {/* Uptime */}
                  <div
                    style={{
                      padding: '0.75rem',
                      background: '#0f172a',
                      borderRadius: '0.375rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <Activity size={14} color={metric.uptime < 95 ? '#f59e0b' : '#10b981'} />
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Uptime</span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: metric.uptime < 95 ? '#f59e0b' : '#10b981',
                      }}
                    >
                      {metric.uptime.toFixed(2)}%
                    </div>
                  </div>

                  {/* Requests/min */}
                  <div
                    style={{
                      padding: '0.75rem',
                      background: '#0f172a',
                      borderRadius: '0.375rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <TrendingUp size={14} color="#94a3b8" />
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Requests/min</span>
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#e2e8f0' }}>
                      {metric.requestsPerMinute}
                    </div>
                  </div>
                </div>

                {/* Average Latency */}
                <div
                  style={{
                    padding: '0.75rem',
                    background: '#0f172a',
                    borderRadius: '0.375rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Avg Latency</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#e2e8f0' }}>
                      {metric.averageLatency}ms
                    </span>
                  </div>
                  <div
                    style={{
                      height: '4px',
                      background: '#334155',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        background: healthColor,
                        width: `${Math.min(100, (metric.averageLatency / 500) * 100)}%`,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Last Checked */}
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
                  Last checked: {new Date(metric.lastChecked).toLocaleTimeString()}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
