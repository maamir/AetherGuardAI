import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, Shield, TrendingUp, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { useRealTimeMetrics } from '../hooks/useWebSocket'
import ActivityFeed from '../components/ActivityFeed'

export default function Dashboard() {
  const [autoRefresh, setAutoRefresh] = useState<number | null>(null)
  const [dateRange, setDateRange] = useState(7)
  
  const { data: usageData, isLoading: usageLoading, refetch: refetchUsage } = useQuery({
    queryKey: ['usage-analytics', dateRange],
    queryFn: () => api.getUsageAnalytics(dateRange),
  })

  const { data: securityData, isLoading: securityLoading, refetch: refetchSecurity } = useQuery({
    queryKey: ['security-analytics', dateRange],
    queryFn: () => api.getSecurityAnalytics(dateRange),
  })

  // Real-time metrics from WebSocket
  const { metrics: realtimeMetrics, isConnected: wsConnected } = useRealTimeMetrics()

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      refetchUsage()
      refetchSecurity()
    }, autoRefresh * 1000)

    return () => clearInterval(interval)
  }, [autoRefresh, refetchUsage, refetchSecurity])

  const isLoading = usageLoading || securityLoading

  // Calculate metrics from real data
  const totalRequests = usageData?.summary?.totalRequests || 0
  const blockedRequests = usageData?.summary?.blockedRequests || 0
  const avgLatency = usageData?.data?.length > 0
    ? (usageData.data.reduce((sum: number, item: any) => sum + (item.latency || 0), 0) / usageData.data.length).toFixed(1)
    : '0'

  // Group security events by type from the API response
  const detections = securityData?.eventTypeCounts?.reduce((acc: any, item: any) => {
    acc[item.type] = item.count
    return acc
  }, {}) || {}

  // Prepare latency trend data from usage data
  const latencyTrend = usageData?.data?.map((item: any) => ({
    hour: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    latency: item.latency || 0,
  })) || []

  const stats = [
    {
      label: 'Total Requests',
      value: isLoading ? '...' : totalRequests.toLocaleString(),
      icon: Activity,
      color: '#60a5fa',
    },
    {
      label: 'Blocked Requests',
      value: isLoading ? '...' : blockedRequests.toLocaleString(),
      icon: Shield,
      color: '#f87171',
    },
    {
      label: 'Avg Latency',
      value: isLoading ? '...' : `${avgLatency}ms`,
      icon: TrendingUp,
      color: '#34d399',
    },
    {
      label: 'Security Events',
      value: isLoading ? '...' : (securityData?.events?.length || 0).toLocaleString(),
      icon: AlertTriangle,
      color: '#fbbf24',
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>
          Dashboard
        </h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Date Range Selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            style={{
              padding: '0.5rem 1rem',
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>

          {/* Auto-Refresh Selector */}
          <select
            value={autoRefresh || ''}
            onChange={(e) => setAutoRefresh(e.target.value ? Number(e.target.value) : null)}
            style={{
              padding: '0.5rem 1rem',
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            <option value="">Auto-refresh: Off</option>
            <option value={5}>Auto-refresh: 5s</option>
            <option value={10}>Auto-refresh: 10s</option>
            <option value={30}>Auto-refresh: 30s</option>
            <option value={60}>Auto-refresh: 1m</option>
          </select>

          {/* WebSocket Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: wsConnected ? '#10b98120' : '#ef444420',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            color: wsConnected ? '#10b981' : '#ef4444',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: wsConnected ? '#10b981' : '#ef4444',
            }} />
            {wsConnected ? 'Live' : 'Offline'}
          </div>

          {/* Manual Refresh */}
          <button
            onClick={() => {
              refetchUsage()
              refetchSecurity()
            }}
            style={{
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem',
      }}>
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
                <div style={{
                  background: `${stat.color}20`,
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                }}>
                  <Icon size={24} color={stat.color} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Latency Chart */}
      <div style={{
        background: '#1e293b',
        padding: '1.5rem',
        borderRadius: '0.75rem',
        border: '1px solid #334155',
        marginBottom: '2rem',
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Latency Trend (24h)
        </h2>
        {isLoading ? (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#94a3b8' }}>Loading...</p>
          </div>
        ) : latencyTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={latencyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                }}
              />
              <Line type="monotone" dataKey="latency" stroke="#60a5fa" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#94a3b8' }}>No data available</p>
          </div>
        )}
      </div>

      {/* Detection Summary */}
      <div style={{
        background: '#1e293b',
        padding: '1.5rem',
        borderRadius: '0.75rem',
        border: '1px solid #334155',
        marginBottom: '2rem',
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Security Detections (24h)
        </h2>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8' }}>Loading...</p>
          </div>
        ) : Object.keys(detections).length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {Object.entries(detections).map(([type, count]) => (
              <div key={type} style={{ padding: '1rem', background: '#0f172a', borderRadius: '0.5rem' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', textTransform: 'capitalize' }}>
                  {type.replace(/_/g, ' ')}
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                  {(count as number).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8' }}>No security events detected</p>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div style={{
        background: '#1e293b',
        padding: '1.5rem',
        borderRadius: '0.75rem',
        border: '1px solid #334155',
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Recent Activity
        </h2>
        <ActivityFeed limit={10} />
      </div>
    </div>
  )
}
