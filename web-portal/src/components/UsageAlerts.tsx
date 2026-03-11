import { useState } from 'react'
import { Bell, Trash2 } from 'lucide-react'

export interface UsageAlert {
  threshold: number
  channel: 'email' | 'webhook'
  destination: string
}

export interface UsageAlertsProps {
  alerts: UsageAlert[]
  onChange: (alerts: UsageAlert[]) => void
  disabled?: boolean
}

export default function UsageAlerts({ alerts = [], onChange, disabled = false }: UsageAlertsProps) {
  const [showForm, setShowForm] = useState(false)
  const [threshold, setThreshold] = useState('80')
  const [channel, setChannel] = useState<'email' | 'webhook'>('email')
  const [destination, setDestination] = useState('')
  const [error, setError] = useState('')

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validateWebhook = (url: string): boolean => {
    try {
      new URL(url)
      return url.startsWith('http://') || url.startsWith('https://')
    } catch {
      return false
    }
  }

  const addAlert = () => {
    setError('')

    if (!threshold || parseInt(threshold) < 1 || parseInt(threshold) > 100) {
      setError('Threshold must be between 1 and 100')
      return
    }

    if (!destination.trim()) {
      setError(`Please enter a ${channel === 'email' ? 'email address' : 'webhook URL'}`)
      return
    }

    if (channel === 'email' && !validateEmail(destination)) {
      setError('Invalid email address')
      return
    }

    if (channel === 'webhook' && !validateWebhook(destination)) {
      setError('Invalid webhook URL (must start with http:// or https://)')
      return
    }

    const newAlert: UsageAlert = {
      threshold: parseInt(threshold),
      channel,
      destination: destination.trim(),
    }

    // Check for duplicates
    if (alerts.some((a) => a.threshold === newAlert.threshold && a.channel === newAlert.channel)) {
      setError('An alert with this threshold and channel already exists')
      return
    }

    onChange([...alerts, newAlert])
    setThreshold('80')
    setChannel('email')
    setDestination('')
    setShowForm(false)
  }

  const removeAlert = (index: number) => {
    onChange(alerts.filter((_, i) => i !== index))
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>
            Usage Alerts (Optional)
          </label>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Get notified when API usage reaches a threshold
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            disabled={disabled}
            style={{
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.875rem',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Bell size={16} />
            Add Alert
          </button>
        )}
      </div>

      {/* Add Alert Form */}
      {showForm && (
        <div
          style={{
            padding: '1rem',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.375rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                Threshold (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#e2e8f0',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as 'email' | 'webhook')}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#e2e8f0',
                  fontSize: '0.875rem',
                }}
              >
                <option value="email">Email</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.25rem' }}>
              {channel === 'email' ? 'Email Address' : 'Webhook URL'}
            </label>
            <input
              type={channel === 'email' ? 'email' : 'url'}
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value)
                setError('')
              }}
              placeholder={channel === 'email' ? 'alerts@example.com' : 'https://example.com/webhook'}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                background: '#0f172a',
                border: error ? '1px solid #ef4444' : '1px solid #334155',
                borderRadius: '0.375rem',
                color: '#e2e8f0',
                fontSize: '0.875rem',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: '0.75rem',
                background: '#7f1d1d',
                border: '1px solid #dc2626',
                borderRadius: '0.375rem',
                color: '#fca5a5',
                fontSize: '0.875rem',
                marginBottom: '1rem',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={addAlert}
              style={{
                flex: 1,
                padding: '0.5rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Add Alert
            </button>
            <button
              onClick={() => {
                setShowForm(false)
                setError('')
              }}
              style={{
                flex: 1,
                padding: '0.5rem',
                background: '#334155',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Alerts List */}
      {alerts.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.375rem',
              }}
            >
              <div style={{ fontSize: '0.875rem', color: '#e2e8f0' }}>
                <span style={{ fontWeight: '500' }}>{alert.threshold}%</span>
                <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>
                  via {alert.channel === 'email' ? '📧' : '🔗'} {alert.destination}
                </span>
              </div>
              <button
                onClick={() => removeAlert(idx)}
                disabled={disabled}
                style={{
                  padding: '0.25rem 0.5rem',
                  background: 'transparent',
                  color: '#ef4444',
                  border: 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: '1rem',
            background: '#0f172a',
            border: '1px dashed #334155',
            borderRadius: '0.375rem',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '0.875rem',
          }}
        >
          No alerts configured. You won't be notified of usage thresholds.
        </div>
      )}
    </div>
  )
}
