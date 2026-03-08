import { useState, useEffect } from 'react'
import { Save, Upload, Download, FileText, CheckCircle, XCircle } from 'lucide-react'

export default function PolicyEditor() {
  const [policies, setPolicies] = useState<any[]>([])
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null)
  const [policyContent, setPolicyContent] = useState('')
  const [isValid, setIsValid] = useState(true)
  const [validationMessage, setValidationMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Load policies on mount
  useEffect(() => {
    loadPolicies()
  }, [])

  const loadPolicies = async () => {
    // Mock data - replace with actual API call
    const mockPolicies = [
      { id: 'default', name: 'Default Policy', version: '1.0.0' },
      { id: 'strict', name: 'Strict Policy', version: '1.0.0' },
      { id: 'permissive', name: 'Permissive Policy', version: '1.0.0' },
    ]
    setPolicies(mockPolicies)
  }

  const loadPolicyContent = async (policyId: string) => {
    // Mock content - replace with actual API call
    const mockContent = {
      default: `{
  "policy_id": "default",
  "name": "Default Security Policy",
  "version": "1.0.0",
  "rules": [
    {
      "type": "injection_detection",
      "enabled": true,
      "threshold": 0.7,
      "action": "block"
    },
    {
      "type": "toxicity_detection",
      "enabled": true,
      "threshold": 0.8,
      "action": "block"
    },
    {
      "type": "pii_detection",
      "enabled": true,
      "action": "redact",
      "redaction_strategy": "mask"
    },
    {
      "type": "rate_limiting",
      "enabled": true,
      "requests_per_minute": 60,
      "requests_per_hour": 1000
    }
  ],
  "enabled": true
}`,
      strict: `{
  "policy_id": "strict",
  "name": "Strict Security Policy",
  "version": "1.0.0",
  "rules": [
    {
      "type": "injection_detection",
      "enabled": true,
      "threshold": 0.5,
      "action": "block"
    },
    {
      "type": "toxicity_detection",
      "enabled": true,
      "threshold": 0.6,
      "action": "block"
    },
    {
      "type": "pii_detection",
      "enabled": true,
      "action": "block"
    },
    {
      "type": "rate_limiting",
      "enabled": true,
      "requests_per_minute": 30,
      "requests_per_hour": 500
    }
  ],
  "enabled": true
}`,
      permissive: `{
  "policy_id": "permissive",
  "name": "Permissive Policy",
  "version": "1.0.0",
  "rules": [
    {
      "type": "injection_detection",
      "enabled": true,
      "threshold": 0.9,
      "action": "log"
    },
    {
      "type": "toxicity_detection",
      "enabled": false
    },
    {
      "type": "pii_detection",
      "enabled": true,
      "action": "log"
    }
  ],
  "enabled": true
}`
    }

    setPolicyContent(mockContent[policyId as keyof typeof mockContent] || '')
    setSelectedPolicy(policyId)
    validatePolicy(mockContent[policyId as keyof typeof mockContent] || '')
  }

  const validatePolicy = (content: string) => {
    try {
      const parsed = JSON.parse(content)
      
      // Basic validation
      if (!parsed.policy_id || !parsed.name || !parsed.rules) {
        setIsValid(false)
        setValidationMessage('Policy must have policy_id, name, and rules')
        return
      }

      if (!Array.isArray(parsed.rules)) {
        setIsValid(false)
        setValidationMessage('Rules must be an array')
        return
      }

      setIsValid(true)
      setValidationMessage('Policy is valid')
    } catch (error) {
      setIsValid(false)
      setValidationMessage('Invalid JSON syntax')
    }
  }

  const handleContentChange = (value: string) => {
    setPolicyContent(value)
    validatePolicy(value)
  }

  const handleSave = async () => {
    if (!isValid) {
      alert('Cannot save invalid policy')
      return
    }

    setIsSaving(true)
    
    // Mock save - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    setIsSaving(false)
    alert('Policy saved successfully!')
  }

  const handleExport = () => {
    const blob = new Blob([policyContent], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedPolicy || 'policy'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setPolicyContent(content)
      validatePolicy(content)
    }
    reader.readAsText(file)
  }

  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
        Policy Editor
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '1.5rem' }}>
        {/* Policy List */}
        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
          height: 'fit-content',
        }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Policies
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {policies.map((policy) => (
              <button
                key={policy.id}
                onClick={() => loadPolicyContent(policy.id)}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: selectedPolicy === policy.id ? '#60a5fa20' : '#0f172a',
                  color: selectedPolicy === policy.id ? '#60a5fa' : '#e2e8f0',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={16} />
                  <div>
                    <p style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>{policy.name}</p>
                    <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>v{policy.version}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          {/* Toolbar */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid #334155',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isValid ? (
                <>
                  <CheckCircle size={20} color="#34d399" />
                  <span style={{ color: '#34d399', fontSize: '0.875rem' }}>
                    {validationMessage}
                  </span>
                </>
              ) : (
                <>
                  <XCircle size={20} color="#f87171" />
                  <span style={{ color: '#f87171', fontSize: '0.875rem' }}>
                    {validationMessage}
                  </span>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <label style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: '#334155',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <Upload size={16} />
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  style={{ display: 'none' }}
                />
              </label>

              <button
                onClick={handleExport}
                disabled={!selectedPolicy}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: '#334155',
                  color: '#fff',
                  cursor: selectedPolicy ? 'pointer' : 'not-allowed',
                  opacity: selectedPolicy ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Download size={16} />
                Export
              </button>

              <button
                onClick={handleSave}
                disabled={!isValid || !selectedPolicy || isSaving}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: isValid && selectedPolicy ? '#60a5fa' : '#334155',
                  color: '#fff',
                  cursor: isValid && selectedPolicy ? 'pointer' : 'not-allowed',
                  opacity: isValid && selectedPolicy ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {/* Editor Area */}
          {selectedPolicy ? (
            <textarea
              value={policyContent}
              onChange={(e) => handleContentChange(e.target.value)}
              style={{
                width: '100%',
                height: '600px',
                background: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                padding: '1rem',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                resize: 'vertical',
              }}
              spellCheck={false}
            />
          ) : (
            <div style={{
              height: '600px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
            }}>
              <p>Select a policy to edit</p>
            </div>
          )}

          {/* Help Text */}
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#0f172a',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            color: '#94a3b8',
          }}>
            <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Policy Structure:</p>
            <ul style={{ marginLeft: '1.5rem', lineHeight: '1.6' }}>
              <li><code>policy_id</code>: Unique identifier</li>
              <li><code>name</code>: Human-readable name</li>
              <li><code>version</code>: Semantic version</li>
              <li><code>rules</code>: Array of rule objects</li>
              <li><code>enabled</code>: Boolean to enable/disable policy</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
