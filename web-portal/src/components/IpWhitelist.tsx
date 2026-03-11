import { useState } from 'react'
import { Plus, Trash2, AlertCircle } from 'lucide-react'

export interface IpWhitelistProps {
  ips: string[]
  onChange: (ips: string[]) => void
  disabled?: boolean
}

export default function IpWhitelist({ ips = [], onChange, disabled = false }: IpWhitelistProps) {
  const [newIp, setNewIp] = useState('')
  const [error, setError] = useState('')

  const validateIp = (ip: string): boolean => {
    // Simple IPv4 validation (including CIDR notation)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
    if (!ipv4Regex.test(ip)) {
      setError('Invalid IP format. Use IPv4 (e.g., 192.168.1.1 or 192.168.1.0/24)')
      return false
    }

    // Validate octets
    const parts = ip.split('/')[0].split('.')
    for (const part of parts) {
      const num = parseInt(part)
      if (num < 0 || num > 255) {
        setError('IP octets must be between 0 and 255')
        return false
      }
    }

    // Validate CIDR if present
    if (ip.includes('/')) {
      const cidr = parseInt(ip.split('/')[1])
      if (cidr < 0 || cidr > 32) {
        setError('CIDR notation must be between 0 and 32')
        return false
      }
    }

    return true
  }

  const addIp = () => {
    if (!newIp.trim()) {
      setError('Please enter an IP address')
      return
    }

    if (!validateIp(newIp.trim())) {
      return
    }

    if (ips.includes(newIp.trim())) {
      setError('This IP is already in the whitelist')
      return
    }

    onChange([...ips, newIp.trim()])
    setNewIp('')
    setError('')
  }

  const removeIp = (ip: string) => {
    onChange(ips.filter((i) => i !== ip))
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
        IP Whitelist (Optional)
      </label>
      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem' }}>
        Leave empty to allow all IPs. Supports CIDR notation (e.g., 192.168.1.0/24)
      </p>

      {/* IP Input */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="text"
          value={newIp}
          onChange={(e) => {
            setNewIp(e.target.value)
            setError('')
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              addIp()
            }
          }}
          disabled={disabled}
          placeholder="e.g., 192.168.1.1 or 192.168.1.0/24"
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            background: '#0f172a',
            border: error ? '1px solid #ef4444' : '1px solid #334155',
            borderRadius: '0.375rem',
            color: '#e2e8f0',
            fontSize: '0.875rem',
            opacity: disabled ? 0.5 : 1,
          }}
        />
        <button
          onClick={addIp}
          disabled={disabled || !newIp.trim()}
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
            opacity: disabled || !newIp.trim() ? 0.5 : 1,
          }}
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            background: '#7f1d1d',
            border: '1px solid #dc2626',
            borderRadius: '0.375rem',
            color: '#fca5a5',
            fontSize: '0.875rem',
            marginBottom: '1rem',
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* IP List */}
      {ips.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {ips.map((ip) => (
            <div
              key={ip}
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
              <code style={{ fontSize: '0.875rem', color: '#e2e8f0' }}>{ip}</code>
              <button
                onClick={() => removeIp(ip)}
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
          No IPs whitelisted. All IPs will be allowed.
        </div>
      )}
    </div>
  )
}
