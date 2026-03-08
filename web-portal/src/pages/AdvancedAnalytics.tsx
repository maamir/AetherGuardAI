import { useState } from 'react'
import { Download, Calendar, TrendingUp, PieChart as PieChartIcon } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, AreaChart
} from 'recharts'

export default function AdvancedAnalytics() {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d')
  const [selectedMetric, setSelectedMetric] = useState<'detections' | 'performance' | 'users'>('detections')

  // Mock data - replace with actual API calls
  const detectionTrend = Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    injection: Math.floor(Math.random() * 50) + 10,
    toxicity: Math.floor(Math.random() * 30) + 5,
    pii: Math.floor(Math.random() * 40) + 15,
    hallucination: Math.floor(Math.random() * 20) + 5,
  }))

  const detectionsByType = [
    { name: 'Injection', value: 1200, color: '#f87171' },
    { name: 'Toxicity', value: 850, color: '#fb923c' },
    { name: 'PII', value: 1100, color: '#fbbf24' },
    { name: 'Hallucination', value: 320, color: '#a78bfa' },
    { name: 'Shadow AI', value: 180, color: '#f472b6' },
  ]

  const performanceMetrics = Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    latency: 15 + Math.random() * 10,
    throughput: 30 + Math.random() * 20,
    errorRate: Math.random() * 2,
  }))

  const userActivity = Array.from({ length: 10 }, (_, i) => ({
    user: `User ${i + 1}`,
    requests: Math.floor(Math.random() * 5000) + 1000,
    blocked: Math.floor(Math.random() * 200) + 50,
  }))

  const costProjection = Array.from({ length: 12 }, (_, i) => ({
    month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
    actual: i < 6 ? 1200 + Math.random() * 300 : null,
    projected: i >= 6 ? 1400 + Math.random() * 400 : null,
  }))

  const exportToCSV = () => {
    const data = detectionTrend.map(row => 
      `${row.time},${row.injection},${row.toxicity},${row.pii},${row.hallucination}`
    ).join('\n')
    
    const csv = 'Time,Injection,Toxicity,PII,Hallucination\n' + data
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${timeRange}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>
          Advanced Analytics
        </h1>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {/* Time Range Selector */}
          <div style={{ display: 'flex', gap: '0.25rem', background: '#1e293b', padding: '0.25rem', borderRadius: '0.5rem' }}>
            {(['24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  background: timeRange === range ? '#60a5fa' : 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Export Button */}
          <button
            onClick={exportToCSV}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#34d399',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Metric Selector */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { id: 'detections', label: 'Security Detections', icon: TrendingUp },
          { id: 'performance', label: 'Performance Metrics', icon: Calendar },
          { id: 'users', label: 'User Activity', icon: PieChartIcon },
        ].map((metric) => {
          const Icon = metric.icon
          return (
            <button
              key={metric.id}
              onClick={() => setSelectedMetric(metric.id as any)}
              style={{
                flex: 1,
                padding: '1rem',
                borderRadius: '0.75rem',
                border: `2px solid ${selectedMetric === metric.id ? '#60a5fa' : '#334155'}`,
                background: selectedMetric === metric.id ? '#60a5fa20' : '#1e293b',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <Icon size={24} color={selectedMetric === metric.id ? '#60a5fa' : '#94a3b8'} />
              <span style={{ fontWeight: 'bold' }}>{metric.label}</span>
            </button>
          )
        })}
      </div>

      {/* Detection Analytics */}
      {selectedMetric === 'detections' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Detection Trend */}
            <div style={{
              background: '#1e293b',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              border: '1px solid #334155',
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                Detection Trend ({timeRange})
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={detectionTrend}>
                  <defs>
                    <linearGradient id="injectionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f87171" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="toxicityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#fb923c" stopOpacity={0}/>
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
                  <Legend />
                  <Area type="monotone" dataKey="injection" stroke="#f87171" fill="url(#injectionGradient)" />
                  <Area type="monotone" dataKey="toxicity" stroke="#fb923c" fill="url(#toxicityGradient)" />
                  <Area type="monotone" dataKey="pii" stroke="#fbbf24" fillOpacity={0.1} />
                  <Area type="monotone" dataKey="hallucination" stroke="#a78bfa" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Detection Distribution */}
            <div style={{
              background: '#1e293b',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              border: '1px solid #334155',
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                Distribution
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={detectionsByType}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {detectionsByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detection Heatmap */}
          <div style={{
            background: '#1e293b',
            padding: '1.5rem',
            borderRadius: '0.75rem',
            border: '1px solid #334155',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              Detection Heatmap (24h)
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: '0.25rem' }}>
              {Array.from({ length: 24 }, (_, i) => {
                const intensity = Math.random()
                return (
                  <div
                    key={i}
                    style={{
                      aspectRatio: '1',
                      background: `rgba(96, 165, 250, ${intensity})`,
                      borderRadius: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      color: intensity > 0.5 ? '#fff' : '#94a3b8',
                    }}
                    title={`${i}:00 - ${Math.floor(intensity * 100)} detections`}
                  >
                    {i}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Performance Analytics */}
      {selectedMetric === 'performance' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Latency Trend */}
          <div style={{
            background: '#1e293b',
            padding: '1.5rem',
            borderRadius: '0.75rem',
            border: '1px solid #334155',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              Latency Trend
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceMetrics}>
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
                <Legend />
                <Line type="monotone" dataKey="latency" stroke="#34d399" strokeWidth={2} name="Latency (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Throughput */}
          <div style={{
            background: '#1e293b',
            padding: '1.5rem',
            borderRadius: '0.75rem',
            border: '1px solid #334155',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              Throughput
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceMetrics}>
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
                <Bar dataKey="throughput" fill="#60a5fa" name="Requests/sec" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cost Projection */}
          <div style={{
            background: '#1e293b',
            padding: '1.5rem',
            borderRadius: '0.75rem',
            border: '1px solid #334155',
            gridColumn: '1 / -1',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              Cost Projection (12 months)
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={costProjection}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="actual" stroke="#34d399" strokeWidth={2} name="Actual Cost ($)" />
                <Line type="monotone" dataKey="projected" stroke="#fbbf24" strokeWidth={2} strokeDasharray="5 5" name="Projected Cost ($)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* User Activity */}
      {selectedMetric === 'users' && (
        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Top Users by Activity
          </h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={userActivity} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94a3b8" />
              <YAxis dataKey="user" type="category" stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                }}
              />
              <Legend />
              <Bar dataKey="requests" fill="#60a5fa" name="Total Requests" />
              <Bar dataKey="blocked" fill="#f87171" name="Blocked Requests" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
