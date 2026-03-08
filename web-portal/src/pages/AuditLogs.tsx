import { useState, useEffect } from 'react'
import { Search, Filter, Download, Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface AuditEvent {
  id: string
  timestamp: string
  eventType: 'training' | 'fine_tuning' | 'deployment' | 'version_transition' | 'inference' | 'policy_update' | 'security_alert'
  modelId: string
  userId: string
  action: string
  status: 'success' | 'failure' | 'warning'
  details: Record<string, any>
  previousHash: string
  currentHash: string
  signature: string
  tampered: boolean
}

export default function AuditLogs() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [filteredEvents, setFilteredEvents] = useState<AuditEvent[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)
  const [showChainView, setShowChainView] = useState(false)

  useEffect(() => {
    // Mock data - replace with actual API call
    const mockEvents: AuditEvent[] = Array.from({ length: 50 }, (_, i) => {
      const types: AuditEvent['eventType'][] = ['training', 'fine_tuning', 'deployment', 'version_transition', 'inference', 'policy_update', 'security_alert']
      const statuses: AuditEvent['status'][] = ['success', 'failure', 'warning']
      
      return {
        id: `evt_${i.toString().padStart(6, '0')}`,
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        eventType: types[Math.floor(Math.random() * types.length)],
        modelId: `model_${Math.floor(Math.random() * 5) + 1}`,
        userId: `user_${Math.floor(Math.random() * 10) + 1}`,
        action: 'Action performed',
        status: statuses[Math.floor(Math.random() * statuses.length)],
        details: { key: 'value' },
        previousHash: `0x${Math.random().toString(16).substring(2, 18)}`,
        currentHash: `0x${Math.random().toString(16).substring(2, 18)}`,
        signature: `sig_${Math.random().toString(36).substring(2, 15)}`,
        tampered: Math.random() > 0.95,
      }
    })
    
    setEvents(mockEvents)
    setFilteredEvents(mockEvents)
  }, [])

  useEffect(() => {
    let filtered = events

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(event =>
        event.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.modelId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.action.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(event => event.eventType === filterType)
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(event => event.status === filterStatus)
    }

    setFilteredEvents(filtered)
  }, [searchQuery, filterType, filterStatus, events])

  const exportLogs = () => {
    const csv = [
      'ID,Timestamp,Type,Model,User,Status,Hash,Tampered',
      ...filteredEvents.map(e => 
        `${e.id},${e.timestamp},${e.eventType},${e.modelId},${e.userId},${e.status},${e.currentHash},${e.tampered}`
      )
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const verifyChain = () => {
    // Verify chain of custody
    let valid = true
    for (let i = 1; i < events.length; i++) {
      if (events[i].previousHash !== events[i - 1].currentHash) {
        valid = false
        break
      }
    }
    alert(valid ? 'Chain of custody verified ✓' : 'Chain integrity compromised!')
  }

  const getStatusIcon = (status: AuditEvent['status']) => {
    switch (status) {
      case 'success': return <CheckCircle size={16} color="#34d399" />
      case 'failure': return <XCircle size={16} color="#f87171" />
      case 'warning': return <AlertTriangle size={16} color="#fbbf24" />
    }
  }

  const getTypeColor = (type: AuditEvent['eventType']) => {
    const colors = {
      training: '#60a5fa',
      fine_tuning: '#a78bfa',
      deployment: '#34d399',
      version_transition: '#fbbf24',
      inference: '#94a3b8',
      policy_update: '#fb923c',
      security_alert: '#f87171',
    }
    return colors[type]
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>
          Audit Logs
        </h1>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={verifyChain}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#60a5fa',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Shield size={16} />
            Verify Chain
          </button>
          
          <button
            onClick={() => setShowChainView(!showChainView)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#a78bfa',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {showChainView ? 'List View' : 'Chain View'}
          </button>
          
          <button
            onClick={exportLogs}
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
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: '#1e293b',
        padding: '1.5rem',
        borderRadius: '0.75rem',
        border: '1px solid #334155',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search
              size={20}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }}
            />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#fff',
              }}
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #334155',
              background: '#0f172a',
              color: '#fff',
            }}
          >
            <option value="all">All Types</option>
            <option value="training">Training</option>
            <option value="fine_tuning">Fine Tuning</option>
            <option value="deployment">Deployment</option>
            <option value="version_transition">Version Transition</option>
            <option value="inference">Inference</option>
            <option value="policy_update">Policy Update</option>
            <option value="security_alert">Security Alert</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #334155',
              background: '#0f172a',
              color: '#fff',
            }}
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="warning">Warning</option>
          </select>
        </div>
      </div>

      {/* Chain View */}
      {showChainView ? (
        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
            Chain of Custody Timeline
          </h2>
          
          <div style={{ position: 'relative', paddingLeft: '2rem' }}>
            {/* Timeline line */}
            <div style={{
              position: 'absolute',
              left: '0.5rem',
              top: 0,
              bottom: 0,
              width: '2px',
              background: '#334155',
            }} />
            
            {filteredEvents.slice(0, 20).map((event, index) => (
              <div
                key={event.id}
                style={{
                  position: 'relative',
                  marginBottom: '1.5rem',
                  paddingLeft: '1.5rem',
                }}
              >
                {/* Timeline dot */}
                <div style={{
                  position: 'absolute',
                  left: '-0.75rem',
                  top: '0.5rem',
                  width: '1rem',
                  height: '1rem',
                  borderRadius: '50%',
                  background: event.tampered ? '#f87171' : getTypeColor(event.eventType),
                  border: '2px solid #1e293b',
                }} />
                
                <div style={{
                  background: event.tampered ? '#7f1d1d' : '#0f172a',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  border: `1px solid ${event.tampered ? '#f87171' : '#334155'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {getStatusIcon(event.status)}
                      <span style={{ fontWeight: 'bold', color: getTypeColor(event.eventType) }}>
                        {event.eventType.replace('_', ' ').toUpperCase()}
                      </span>
                      {event.tampered && (
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          background: '#f87171',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                        }}>
                          TAMPERED
                        </span>
                      )}
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
                    <div>Event ID: {event.id}</div>
                    <div>Model: {event.modelId} | User: {event.userId}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                      Hash: {event.currentHash}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* List View */
        <div style={{
          background: '#1e293b',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Event ID</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Model</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>User</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Timestamp</th>
                <th style={{ padding: '1rem', textAlign: 'left' }}>Hash</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => (
                <tr
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  style={{
                    borderBottom: '1px solid #334155',
                    cursor: 'pointer',
                    background: event.tampered ? '#7f1d1d' : 'transparent',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = event.tampered ? '#991b1b' : '#0f172a'}
                  onMouseLeave={(e) => e.currentTarget.style.background = event.tampered ? '#7f1d1d' : 'transparent'}
                >
                  <td style={{ padding: '1rem' }}>
                    {getStatusIcon(event.status)}
                  </td>
                  <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {event.id}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      background: getTypeColor(event.eventType) + '30',
                      color: getTypeColor(event.eventType),
                      fontSize: '0.875rem',
                    }}>
                      {event.eventType.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem' }}>{event.modelId}</td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem' }}>{event.userId}</td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#94a3b8' }}>
                    {new Date(event.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#94a3b8' }}>
                    {event.currentHash.substring(0, 12)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedEvent(null)}
        >
          <div
            style={{
              background: '#1e293b',
              padding: '2rem',
              borderRadius: '0.75rem',
              border: '1px solid #334155',
              maxWidth: '600px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
              Event Details
            </h2>
            
            <div style={{ display: 'grid', gap: '1rem', fontSize: '0.875rem' }}>
              <div>
                <div style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>Event ID</div>
                <div style={{ fontFamily: 'monospace' }}>{selectedEvent.id}</div>
              </div>
              
              <div>
                <div style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>Type</div>
                <div>{selectedEvent.eventType.replace('_', ' ').toUpperCase()}</div>
              </div>
              
              <div>
                <div style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>Status</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {getStatusIcon(selectedEvent.status)}
                  {selectedEvent.status}
                </div>
              </div>
              
              <div>
                <div style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>Timestamp</div>
                <div>{new Date(selectedEvent.timestamp).toLocaleString()}</div>
              </div>
              
              <div>
                <div style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>Previous Hash</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                  {selectedEvent.previousHash}
                </div>
              </div>
              
              <div>
                <div style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>Current Hash</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                  {selectedEvent.currentHash}
                </div>
              </div>
              
              <div>
                <div style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>Signature</div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                  {selectedEvent.signature}
                </div>
              </div>
              
              {selectedEvent.tampered && (
                <div style={{
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  background: '#7f1d1d',
                  border: '1px solid #f87171',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', color: '#f87171' }}>
                    <AlertTriangle size={20} />
                    TAMPERING DETECTED
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                    This event's hash chain has been compromised. Investigate immediately.
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setSelectedEvent(null)}
              style={{
                marginTop: '1.5rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: '#60a5fa',
                color: '#fff',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
