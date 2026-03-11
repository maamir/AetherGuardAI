import { useState } from 'react'
import { GripVertical, Trash2, Plus, AlertCircle } from 'lucide-react'

export interface FallbackProvider {
  providerId: string
  providerName: string
  priority: number
}

export interface FallbackConfigProps {
  providers: Array<{ id: string; name: string }>
  fallbacks: FallbackProvider[]
  onChange: (fallbacks: FallbackProvider[]) => void
  disabled?: boolean
}

export default function FallbackConfig({
  providers = [],
  fallbacks = [],
  onChange,
  disabled = false,
}: FallbackConfigProps) {
  const [draggedItem, setDraggedItem] = useState<number | null>(null)
  const [error, setError] = useState('')

  const availableProviders = providers.filter(
    (p) => !fallbacks.some((f) => f.providerId === p.id)
  )

  const addFallback = (providerId: string) => {
    setError('')

    const provider = providers.find((p) => p.id === providerId)
    if (!provider) {
      setError('Provider not found')
      return
    }

    const newFallback: FallbackProvider = {
      providerId,
      providerName: provider.name,
      priority: fallbacks.length + 1,
    }

    onChange([...fallbacks, newFallback])
  }

  const removeFallback = (providerId: string) => {
    const updated = fallbacks
      .filter((f) => f.providerId !== providerId)
      .map((f, idx) => ({ ...f, priority: idx + 1 }))
    onChange(updated)
  }

  const handleDragStart = (index: number) => {
    setDraggedItem(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedItem === null || draggedItem === index) return

    const newFallbacks = [...fallbacks]
    const draggedFallback = newFallbacks[draggedItem]
    newFallbacks.splice(draggedItem, 1)
    newFallbacks.splice(index, 0, draggedFallback)

    // Update priorities
    newFallbacks.forEach((f, idx) => {
      f.priority = idx + 1
    })

    setDraggedItem(index)
    onChange(newFallbacks)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>
            Fallback Providers
          </label>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Configure backup providers in priority order. Drag to reorder.
          </p>
        </div>
        {availableProviders.length > 0 && (
          <select
            onChange={(e) => {
              if (e.target.value) {
                addFallback(e.target.value)
                e.target.value = ''
              }
            }}
            disabled={disabled}
            style={{
              padding: '0.5rem 0.75rem',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
              color: '#e2e8f0',
              fontSize: '0.875rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <option value="">Add fallback provider...</option>
            {availableProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

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

      {fallbacks.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {fallbacks.map((fallback, idx) => (
            <div
              key={fallback.providerId}
              draggable={!disabled}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: draggedItem === idx ? '#334155' : '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.375rem',
                cursor: disabled ? 'default' : 'grab',
                opacity: draggedItem === idx ? 0.7 : 1,
                transition: 'all 0.2s',
              }}
            >
              {!disabled && (
                <GripVertical
                  size={18}
                  color="#94a3b8"
                  style={{ cursor: 'grab', flexShrink: 0 }}
                />
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  background: '#3b82f6',
                  color: 'white',
                  borderRadius: '50%',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  flexShrink: 0,
                }}
              >
                {fallback.priority}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#e2e8f0' }}>
                  {fallback.providerName}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {fallback.priority === 1 ? 'Primary fallback' : `Fallback #${fallback.priority}`}
                </div>
              </div>

              <button
                onClick={() => removeFallback(fallback.providerId)}
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
          No fallback providers configured. Add one to enable automatic failover.
        </div>
      )}

      {/* Info Box */}
      <div
        style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: '#1e3a1f',
          border: '1px solid #15803d',
          borderRadius: '0.375rem',
          fontSize: '0.75rem',
          color: '#86efac',
        }}
      >
        <strong>How it works:</strong> If the primary provider fails, requests will automatically be routed to the first
        fallback. If that fails, the next fallback is used, and so on.
      </div>
    </div>
  )
}
