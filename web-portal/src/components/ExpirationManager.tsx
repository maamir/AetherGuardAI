import { Calendar, AlertTriangle } from 'lucide-react'

export interface ExpirationManagerProps {
  expiresAt: string | null
  onChange: (date: string | null) => void
  disabled?: boolean
}

export default function ExpirationManager({ expiresAt, onChange, disabled = false }: ExpirationManagerProps) {
  const getExpirationStatus = (date: string | null) => {
    if (!date) return { status: 'never', color: '#94a3b8', label: 'Never expires' }

    const expiryDate = new Date(date)
    const now = new Date()
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiry < 0) {
      return { status: 'expired', color: '#ef4444', label: 'Expired', days: 0 }
    } else if (daysUntilExpiry < 7) {
      return { status: 'critical', color: '#ef4444', label: `Expires in ${daysUntilExpiry} days`, days: daysUntilExpiry }
    } else if (daysUntilExpiry < 30) {
      return { status: 'warning', color: '#f59e0b', label: `Expires in ${daysUntilExpiry} days`, days: daysUntilExpiry }
    } else {
      return { status: 'safe', color: '#10b981', label: `Expires in ${daysUntilExpiry} days`, days: daysUntilExpiry }
    }
  }

  const status = getExpirationStatus(expiresAt)
  const minDate = new Date().toISOString().split('T')[0]

  return (
    <div style={{ marginTop: '1rem' }}>
      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
        Expiration Date (Optional)
      </label>
      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem' }}>
        Leave empty for keys that never expire
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="date"
            value={expiresAt ? expiresAt.split('T')[0] : ''}
            onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
            min={minDate}
            disabled={disabled}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
              color: '#e2e8f0',
              fontSize: '0.875rem',
              opacity: disabled ? 0.5 : 1,
            }}
          />
          <Calendar
            size={16}
            style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              pointerEvents: 'none',
            }}
          />
        </div>
        {expiresAt && (
          <button
            onClick={() => onChange(null)}
            disabled={disabled}
            style={{
              padding: '0.5rem 1rem',
              background: '#334155',
              color: '#e2e8f0',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Status Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem',
          background: `${status.color}20`,
          border: `1px solid ${status.color}40`,
          borderRadius: '0.375rem',
          color: status.color,
          fontSize: '0.875rem',
        }}
      >
        {status.status === 'critical' || status.status === 'expired' ? (
          <AlertTriangle size={16} />
        ) : (
          <Calendar size={16} />
        )}
        <span>{status.label}</span>
      </div>

      {/* Expiration Info */}
      {expiresAt && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            color: '#e2e8f0',
          }}
        >
          <p>
            <strong>Expiration Date:</strong> {new Date(expiresAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          {status.status === 'critical' && (
            <p style={{ marginTop: '0.5rem', color: '#fca5a5' }}>
              ⚠️ This key will expire soon. Consider rotating it.
            </p>
          )}
          {status.status === 'expired' && (
            <p style={{ marginTop: '0.5rem', color: '#fca5a5' }}>
              ⚠️ This key has expired and is no longer valid.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
