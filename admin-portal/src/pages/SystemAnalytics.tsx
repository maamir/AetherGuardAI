import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { adminApi } from '../services/api'
import { useState } from 'react'

interface AnalyticsData {
  requestsOverTime: Array<{ date: string; requests: number }>
  eventTypeDistribution: Array<{ type: string; count: number }>
}

export default function SystemAnalytics() {
  const [dateRange, setDateRange] = useState(30)

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['system-analytics', dateRange],
    queryFn: () => adminApi.getSystemAnalytics(dateRange),
  })

  const requestsData = analytics?.requestsOverTime || []
  const eventTypesData = analytics?.eventTypeDistribution || []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>System Analytics</h1>
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
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Requests Over Time */}
      <div
        style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
          marginBottom: '2rem',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Requests Over Time
        </h2>
        {isLoading ? (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#94a3b8' }}>Loading...</p>
          </div>
        ) : requestsData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={requestsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                }}
              />
              <Line type="monotone" dataKey="requests" stroke="#60a5fa" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#94a3b8' }}>No data available</p>
          </div>
        )}
      </div>

      {/* Event Type Distribution */}
      <div
        style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Event Type Distribution
        </h2>
        {isLoading ? (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#94a3b8' }}>Loading...</p>
          </div>
        ) : eventTypesData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={eventTypesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="type" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                }}
              />
              <Bar dataKey="count" fill="#60a5fa" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#94a3b8' }}>No data available</p>
          </div>
        )}
      </div>
    </div>
  )
}
