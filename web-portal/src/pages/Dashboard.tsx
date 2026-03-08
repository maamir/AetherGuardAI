import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, Shield, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: async () => {
      // Mock data - replace with actual API call
      return {
        totalRequests: 125000,
        blockedRequests: 3250,
        avgLatency: 18.5,
        activeUsers: 1250,
        detections: {
          injection: 1200,
          toxicity: 850,
          pii: 1100,
          hallucination: 100,
        },
        latencyTrend: Array.from({ length: 24 }, (_, i) => ({
          hour: `${i}:00`,
          latency: 15 + Math.random() * 10,
        })),
      }
    },
  })

  const stats = [
    {
      label: 'Total Requests',
      value: metrics?.totalRequests.toLocaleString() || '0',
      icon: Activity,
      color: '#60a5fa',
    },
    {
      label: 'Blocked Requests',
      value: metrics?.blockedRequests.toLocaleString() || '0',
      icon: Shield,
      color: '#f87171',
    },
    {
      label: 'Avg Latency',
      value: `${metrics?.avgLatency || 0}ms`,
      icon: TrendingUp,
      color: '#34d399',
    },
    {
      label: 'Active Users',
      value: metrics?.activeUsers.toLocaleString() || '0',
      icon: AlertTriangle,
      color: '#fbbf24',
    },
  ]

  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
        Dashboard
      </h1>

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
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={metrics?.latencyTrend || []}>
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
      </div>

      {/* Detection Summary */}
      <div style={{
        background: '#1e293b',
        padding: '1.5rem',
        borderRadius: '0.75rem',
        border: '1px solid #334155',
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Security Detections (24h)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {Object.entries(metrics?.detections || {}).map(([type, count]) => (
            <div key={type} style={{ padding: '1rem', background: '#0f172a', borderRadius: '0.5rem' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', textTransform: 'capitalize' }}>
                {type}
              </p>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                {count.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
