import { useState, useEffect } from 'react'
import { Activity, AlertTriangle, Shield, TrendingUp, Wifi, WifiOff } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { useRealTimeMetrics, useDetectionEvents } from '../hooks/useWebSocket'

export default function RealTimeDashboard() {
  const { metrics, isConnected } = useRealTimeMetrics()
  const { events, clearEvents } = useDetectionEvents()
  const [latencyHistory, setLatencyHistory] = useState<any[]>([])
  const [requestHistory, setRequestHistory] = useState<any[]>([])

  // Update history when metrics change
  useEffect(() => {
    if (metrics) {
      const timestamp = new Date().toLocaleTimeString()
      
      setLatencyHistory((prev) => [
        ...prev.slice(-29), // Keep last 30 points
        { time: timestamp, latency: metrics.avgLatency || 0 }
      ])

      setRequestHistory((prev) => [
        ...prev.slice(-29),
        { time: timestamp, requests: metrics.requestsPerSecond || 0 }
      ])
    }
  }, [metrics])

  const stats = [
    {
      label: 'Requests/sec',
      value: metrics?.requestsPerSecond?.toFixed(1) || '0',
      icon: Activity,
      color: '#60a5fa',
      trend: '+12%',
    },
    {
      label: 'Blocked',
      value: metrics?.blockedCount || '0',
      icon: Shield,
      color: '#f87171',
      trend: '-5%',
    },
    {
      label: 'Avg Latency',
      value: `${metrics?.avgLatency?.toFixed(1) || '0'}ms`,
      icon: TrendingUp,
      color: '#34d399',
      trend: '-8%',
    },
    {
      label: 'Active Users',
      value: metrics?.activeUsers || '0',
      icon: AlertTriangle,
      color: '#fbbf24',
      trend: '+3%',
    },
  ]

  return (
    <div>
      {/* Header with connection status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>
          Real-Time Dashboard
        </h1>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          borderRadius: '0.5rem',
          background: isConnected ? '#34d39920' : '#f8717120',
        }}>
          {isConnected ? <Wifi size={20} color="#34d399" /> : <WifiOff size={20} color="#f87171" />}
          <span style={{ color: isConnected ? '#34d399' : '#f87171' }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Real-time Stats */}
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
                  <p style={{ 
                    color: stat.trend.startsWith('+') ? '#34d399' : '#f87171', 
                    fontSize: '0.875rem',
                    marginTop: '0.5rem'
                  }}>
                    {stat.trend} from last hour
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

      {/* Real-time Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Latency Chart */}
        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Latency (Real-Time)
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={latencyHistory}>
              <defs>
                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                }}
              />
              <Area 
                type="monotone" 
                dataKey="latency" 
                stroke="#34d399" 
                fill="url(#latencyGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Request Rate Chart */}
        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Request Rate (Real-Time)
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={requestHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                }}
              />
              <Line 
                type="monotone" 
                dataKey="requests" 
                stroke="#60a5fa" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live Detection Feed */}
      <div style={{
        background: '#1e293b',
        padding: '1.5rem',
        borderRadius: '0.75rem',
        border: '1px solid #334155',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
            Live Detection Feed
          </h2>
          <button
            onClick={clearEvents}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#334155',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>

        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {events.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
              No detections yet. Waiting for events...
            </p>
          ) : (
            events.map((event, index) => (
              <div
                key={index}
                style={{
                  padding: '1rem',
                  marginBottom: '0.5rem',
                  background: '#0f172a',
                  borderRadius: '0.5rem',
                  borderLeft: `4px solid ${getDetectionColor(event.type)}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <p style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                      {event.type}
                    </p>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                      {event.message || 'Detection triggered'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ 
                      color: getDetectionColor(event.type),
                      fontSize: '0.875rem',
                      fontWeight: 'bold'
                    }}>
                      {event.severity || 'MEDIUM'}
                    </p>
                    <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function getDetectionColor(type: string): string {
  const colors: Record<string, string> = {
    injection: '#f87171',
    toxicity: '#fb923c',
    pii: '#fbbf24',
    hallucination: '#a78bfa',
    shadow_ai: '#f472b6',
    default: '#60a5fa',
  }
  return colors[type.toLowerCase()] || colors.default
}
