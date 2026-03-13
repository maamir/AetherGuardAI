import { useState, useEffect } from 'react'
import { Shield, AlertTriangle, CheckCircle, XCircle, Eye, Filter } from 'lucide-react'
import { api } from '../services/api'

interface SecurityEvent {
  id: string
  created_at: string
  event_type: string
  severity: string
  description: string
  request_id?: string
  metadata: any
}

export default function SecurityEvents() {
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  useEffect(() => {
    fetchSecurityEvents()
  }, [filter])

  const fetchSecurityEvents = async () => {
    try {
      const severity = filter === 'all' ? undefined : filter
      const data = await api.getSecurityAnalytics(7, severity)
      
      setEvents(data.events || [])
      setStats({
        eventTypeCounts: data.eventTypeCounts || [],
        severityCounts: data.severityCounts || []
      })
    } catch (error) {
      console.error('Failed to fetch security events:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    if (severity === 'high' || severity === 'critical') return '#ef4444'
    if (severity === 'medium') return '#f59e0b'
    return '#10b981'
  }

  const getSeverityLabel = (severity: string) => {
    return severity.charAt(0).toUpperCase() + severity.slice(1)
  }

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true
    return event.severity === filter
  })

  const totalEvents = events.length
  const blockedEvents = events.filter(e => e.event_type === 'request_blocked').length
  const highSeverity = events.filter(e => e.severity === 'high' || e.severity === 'critical').length
  const allowedEvents = totalEvents - blockedEvents

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8' }}>Loading security events...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f8fafc', marginBottom: '0.5rem' }}>
          Security Events
        </h1>
        <p style={{ color: '#94a3b8' }}>
          Real-time security detection results for all requests
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Shield size={24} color="#60a5fa" />
            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Total Events</span>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f8fafc' }}>{totalEvents}</p>
        </div>

        <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <XCircle size={24} color="#ef4444" />
            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Blocked</span>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f8fafc' }}>
            {blockedEvents}
          </p>
        </div>

        <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <AlertTriangle size={24} color="#f59e0b" />
            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>High Severity</span>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f8fafc' }}>
            {highSeverity}
          </p>
        </div>

        <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <CheckCircle size={24} color="#10b981" />
            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Allowed</span>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f8fafc' }}>
            {allowedEvents}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            background: filter === 'all' ? '#3b82f6' : '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Filter size={16} />
          All Events
        </button>
        <button
          onClick={() => setFilter('high')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            background: filter === 'high' ? '#3b82f6' : '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <XCircle size={16} />
          High Severity
        </button>
        <button
          onClick={() => setFilter('medium')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            background: filter === 'medium' ? '#3b82f6' : '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <AlertTriangle size={16} />
          Medium Severity
        </button>
        <button
          onClick={() => setFilter('low')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            background: filter === 'low' ? '#3b82f6' : '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <CheckCircle size={16} />
          Low Severity
        </button>
      </div>

      {/* Events List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', background: '#1e293b', borderRadius: '0.75rem', border: '1px solid #334155' }}>
            <Eye size={48} color="#94a3b8" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p style={{ color: '#94a3b8' }}>No security events found</p>
          </div>
        ) : (
          filteredEvents.map(event => {
            const severityColor = getSeverityColor(event.severity || 'low')
            const severityLabel = getSeverityLabel(event.severity || 'low')
            const isBlocked = event.event_type === 'request_blocked'

            return (
              <div
                key={event.id}
                style={{
                  background: '#1e293b',
                  borderRadius: '0.75rem',
                  border: '1px solid #334155',
                  borderLeft: `4px solid ${severityColor}`,
                  padding: '1.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '0.375rem', 
                        background: severityColor + '20',
                        color: severityColor,
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        {severityLabel} Severity
                      </span>
                      <span style={{ 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '0.375rem', 
                        background: isBlocked ? '#ef444420' : '#10b98120',
                        color: isBlocked ? '#ef4444' : '#10b981',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        {isBlocked ? 'BLOCKED' : 'ALLOWED'}
                      </span>
                      {event.event_type && (
                        <span style={{ 
                          padding: '0.25rem 0.75rem', 
                          borderRadius: '0.375rem', 
                          background: '#3b82f620',
                          color: '#3b82f6',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          {event.event_type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p style={{ color: '#f8fafc', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                      {event.description || 'No description available'}
                    </p>
                    {event.request_id && (
                      <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                        Request ID: {event.request_id}
                      </p>
                    )}
                    <p style={{ color: '#64748b', fontSize: '0.75rem' }}>
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Metadata */}
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#0f172a', borderRadius: '0.5rem' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.5rem', fontWeight: '600' }}>
                      Event Details
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                      {Object.entries(event.metadata).map(([key, value]) => {
                        if (key === null || key === undefined) return null;
                        return (
                          <div key={key}>
                            <p style={{ color: '#64748b', fontSize: '0.7rem', marginBottom: '0.25rem' }}>
                              {String(key).replace(/_/g, ' ').toUpperCase()}
                            </p>
                            <p style={{ color: '#f8fafc', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
