import { useState } from 'react'
import { Copy, Plus, Trash2 } from 'lucide-react'

export interface PolicyTemplate {
  id: string
  name: string
  description: string
  config: Record<string, any>
  isPreset?: boolean
}

export interface PolicyTemplatesProps {
  templates: PolicyTemplate[]
  onSelect: (template: PolicyTemplate) => void
  onSave?: (template: PolicyTemplate) => void
  onDelete?: (templateId: string) => void
}

const PRESET_TEMPLATES: PolicyTemplate[] = [
  {
    id: 'strict',
    name: 'Strict',
    description: 'All features enabled with low thresholds',
    isPreset: true,
    config: {
      prompt_injection: { enabled: true, threshold: 0.3 },
      toxicity: { enabled: true, threshold: 0.2 },
      pii: { enabled: true, threshold: 0.1 },
      hallucination: { enabled: true, threshold: 0.4 },
      bias: { enabled: true, threshold: 0.3 },
    },
  },
  {
    id: 'moderate',
    name: 'Moderate',
    description: 'Balanced security and performance',
    isPreset: true,
    config: {
      prompt_injection: { enabled: true, threshold: 0.5 },
      toxicity: { enabled: true, threshold: 0.4 },
      pii: { enabled: true, threshold: 0.3 },
      hallucination: { enabled: true, threshold: 0.6 },
      bias: { enabled: true, threshold: 0.5 },
    },
  },
  {
    id: 'permissive',
    name: 'Permissive',
    description: 'Minimal restrictions, high thresholds',
    isPreset: true,
    config: {
      prompt_injection: { enabled: true, threshold: 0.8 },
      toxicity: { enabled: true, threshold: 0.7 },
      pii: { enabled: false, threshold: 0.9 },
      hallucination: { enabled: false, threshold: 0.9 },
      bias: { enabled: false, threshold: 0.8 },
    },
  },
]

export default function PolicyTemplates({
  templates = [],
  onSelect,
  onSave,
  onDelete,
}: PolicyTemplatesProps) {
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customDescription, setCustomDescription] = useState('')
  const [error, setError] = useState('')

  const allTemplates = [...PRESET_TEMPLATES, ...templates]

  const handleCreateCustom = () => {
    setError('')

    if (!customName.trim()) {
      setError('Template name is required')
      return
    }

    if (allTemplates.some((t) => t.name.toLowerCase() === customName.toLowerCase())) {
      setError('A template with this name already exists')
      return
    }

    const newTemplate: PolicyTemplate = {
      id: `custom-${Date.now()}`,
      name: customName,
      description: customDescription,
      config: {},
    }

    onSave?.(newTemplate)
    setCustomName('')
    setCustomDescription('')
    setShowCustomForm(false)
  }

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
            Policy Templates
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
            Choose a preset or create a custom template
          </p>
        </div>
        {!showCustomForm && (
          <button
            onClick={() => setShowCustomForm(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            <Plus size={16} />
            New Template
          </button>
        )}
      </div>

      {/* Custom Template Form */}
      {showCustomForm && (
        <div
          style={{
            padding: '1rem',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                Template Name *
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => {
                  setCustomName(e.target.value)
                  setError('')
                }}
                placeholder="e.g., Production"
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
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                Description
              </label>
              <input
                type="text"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="e.g., For production environment"
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
              onClick={handleCreateCustom}
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
              Create Template
            </button>
            <button
              onClick={() => {
                setShowCustomForm(false)
                setCustomName('')
                setCustomDescription('')
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

      {/* Templates Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
        {allTemplates.map((template) => (
          <div
            key={template.id}
            style={{
              padding: '1rem',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#3b82f6'
              e.currentTarget.style.background = '#334155'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#334155'
              e.currentTarget.style.background = '#1e293b'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#e2e8f0' }}>
                  {template.name}
                </h3>
                {template.isPreset && (
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '0.25rem',
                      padding: '0.125rem 0.5rem',
                      background: '#3b82f620',
                      color: '#3b82f6',
                      fontSize: '0.625rem',
                      borderRadius: '0.25rem',
                    }}
                  >
                    Preset
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  onClick={() => onSelect(template)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <Copy size={12} />
                  Use
                </button>
                {!template.isPreset && onDelete && (
                  <button
                    onClick={() => onDelete(template.id)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.4' }}>
              {template.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
