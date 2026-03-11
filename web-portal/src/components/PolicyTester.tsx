import { useState } from 'react'
import { Play, Trash2, History } from 'lucide-react'

export interface TestResult {
  id: string
  input: string
  timestamp: string
  results: Array<{
    policy: string
    matched: boolean
    confidence: number
    reason?: string
  }>
}

export interface PolicyTesterProps {
  onTest: (input: string) => Promise<any>
  isLoading?: boolean
}

export default function PolicyTester({ onTest, isLoading = false }: PolicyTesterProps) {
  const [testInput, setTestInput] = useState('')
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [currentResult, setCurrentResult] = useState<TestResult | null>(null)
  const [error, setError] = useState('')

  const handleTest = async () => {
    setError('')

    if (!testInput.trim()) {
      setError('Please enter some text to test')
      return
    }

    try {
      const result = await onTest(testInput)

      const testResult: TestResult = {
        id: `test-${Date.now()}`,
        input: testInput,
        timestamp: new Date().toISOString(),
        results: result.results || [],
      }

      setTestResults([testResult, ...testResults])
      setCurrentResult(testResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed')
    }
  }

  const clearHistory = () => {
    if (confirm('Clear all test history?')) {
      setTestResults([])
      setCurrentResult(null)
    }
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        Policy Tester
      </h2>

      {/* Test Input */}
      <div
        style={{
          padding: '1rem',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
          Test Input
        </label>
        <textarea
          value={testInput}
          onChange={(e) => {
            setTestInput(e.target.value)
            setError('')
          }}
          placeholder="Enter text to test against policies..."
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '0.75rem',
            background: '#0f172a',
            border: error ? '1px solid #ef4444' : '1px solid #334155',
            borderRadius: '0.375rem',
            color: '#e2e8f0',
            fontSize: '0.875rem',
            fontFamily: 'monospace',
            resize: 'vertical',
          }}
        />

        {error && (
          <div
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              background: '#7f1d1d',
              border: '1px solid #dc2626',
              borderRadius: '0.375rem',
              color: '#fca5a5',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            onClick={handleTest}
            disabled={isLoading || !testInput.trim()}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              opacity: isLoading || !testInput.trim() ? 0.5 : 1,
            }}
          >
            <Play size={16} />
            {isLoading ? 'Testing...' : 'Run Test'}
          </button>
          {testResults.length > 0 && (
            <button
              onClick={clearHistory}
              style={{
                padding: '0.75rem 1rem',
                background: '#334155',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              <Trash2 size={16} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Current Result */}
      {currentResult && (
        <div
          style={{
            padding: '1rem',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem', color: '#e2e8f0' }}>
            Test Result
          </h3>

          <div
            style={{
              padding: '0.75rem',
              background: '#0f172a',
              borderRadius: '0.375rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              color: '#cbd5e1',
              maxHeight: '100px',
              overflow: 'auto',
            }}
          >
            "{currentResult.input}"
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {currentResult.results.map((result, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.75rem',
                  background: result.matched ? '#7f1d1d' : '#1e3a1f',
                  border: `1px solid ${result.matched ? '#dc2626' : '#15803d'}`,
                  borderRadius: '0.375rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: result.matched ? '#fca5a5' : '#86efac',
                        marginBottom: '0.25rem',
                      }}
                    >
                      {result.policy}
                    </div>
                    {result.reason && (
                      <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                        {result.reason}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: result.matched ? '#fca5a5' : '#86efac',
                      }}
                    >
                      {result.matched ? '⚠️ Matched' : '✓ Passed'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {(result.confidence * 100).toFixed(1)}% confidence
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test History */}
      {testResults.length > 0 && (
        <div
          style={{
            padding: '1rem',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <History size={18} color="#94a3b8" />
            <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#e2e8f0' }}>
              Test History ({testResults.length})
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflow: 'auto' }}>
            {testResults.map((result) => (
              <button
                key={result.id}
                onClick={() => setCurrentResult(result)}
                style={{
                  padding: '0.75rem',
                  background: currentResult?.id === result.id ? '#334155' : '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#334155'
                }}
                onMouseLeave={(e) => {
                  if (currentResult?.id !== result.id) {
                    e.currentTarget.style.background = '#0f172a'
                  }
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                  {new Date(result.timestamp).toLocaleTimeString()}
                </div>
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: '#e2e8f0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  "{result.input}"
                </div>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.25rem' }}>
                  {result.results.filter((r) => r.matched).length} of {result.results.length} policies matched
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
