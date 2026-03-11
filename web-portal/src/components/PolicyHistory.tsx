import { useState } from 'react'
import { ChevronDown, ChevronUp, RotateCcw, Eye } from 'lucide-react'

export interface PolicyVersion {
  version: number
  config: Record<string, any>
  createdAt: string
  createdBy: string
  changes?: string
}

export interface PolicyHistoryProps {
  versions: PolicyVersion[]
  currentVersion: number
  onRollback: (version: number) => void
  onCompare?: (v1: number, v2: number) => void
}

export default function PolicyHistory({
  versions = [],
  currentVersion,
  onRollback,
  onCompare,
}: PolicyHistoryProps) {
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareVersions, setCompareVersions] = useState<[number, number] | null>(null)

  const sortedVersions = [...versions].sort((a, b) => b.version - a.version)

  const handleRollback = (version: number) => {
    if (confirm(`Are you sure you want to rollback to version ${version}?`)) {
      onRollback(version)
    }
  }

  const handleCompare = (v1: number, v2: number) => {
    if (v1 !== v2) {
      setCompareVersions([Math.max(v1, v2), Math.min(v1, v2)])
      onCompare?.(v1, v2)
    }
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Version History</h2>
        <button
          onClick={() => setCompareMode(!compareMode)}
          style={{
            padding: '0.5rem 1rem',
            background: compareMode ? '#3b82f6' : '#334155',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          {compareMode ? 'Exit Compare' : 'Compare Versions'}
        </button>
      </div>

      {/* Version List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {sortedVersions.map((version) => (
          <div
            key={version.version}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              overflow: 'hidden',
            }}
          >
            {/* Version Header */}
            <div
              onClick={() => setExpandedVersion(expandedVersion === version.version ? null : version.version)}
              style={{
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                background: version.version === currentVersion ? '#334155' : 'transparent',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                if (version.version !== currentVersion) {
                  e.currentTarget.style.background = '#334155'
                }
              }}
              onMouseLeave={(e) => {
                if (version.version !== currentVersion) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#e2e8f0' }}>
                    Version {version.version}
                  </span>
                  {version.version === currentVersion && (
                    <span
                      style={{
                        padding: '0.125rem 0.5rem',
                        background: '#10b98120',
                        color: '#10b981',
                        fontSize: '0.625rem',
                        borderRadius: '0.25rem',
                        fontWeight: '600',
                      }}
                    >
                      Current
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {new Date(version.createdAt).toLocaleString()} • by {version.createdBy}
                </div>
                {version.changes && (
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.25rem' }}>
                    {version.changes}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {compareMode && (
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        if (!compareVersions) {
                          setCompareVersions([version.version, version.version])
                        } else if (compareVersions[0] === version.version || compareVersions[1] === version.version) {
                          setCompareVersions(null)
                        } else {
                          setCompareVersions([compareVersions[0], version.version])
                        }
                      } else {
                        setCompareVersions(null)
                      }
                    }}
                    checked={
                      compareVersions
                        ? compareVersions[0] === version.version || compareVersions[1] === version.version
                        : false
                    }
                    style={{ cursor: 'pointer' }}
                  />
                )}
                {version.version !== currentVersion && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRollback(version.version)
                    }}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: '#f59e0b',
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
                    <RotateCcw size={12} />
                    Rollback
                  </button>
                )}
                {expandedVersion === version.version ? (
                  <ChevronUp size={18} color="#94a3b8" />
                ) : (
                  <ChevronDown size={18} color="#94a3b8" />
                )}
              </div>
            </div>

            {/* Version Details */}
            {expandedVersion === version.version && (
              <div style={{ padding: '1rem', background: '#0f172a', borderTop: '1px solid #334155' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                  Configuration:
                </div>
                <pre
                  style={{
                    background: '#1e293b',
                    padding: '0.75rem',
                    borderRadius: '0.375rem',
                    overflow: 'auto',
                    fontSize: '0.7rem',
                    color: '#e2e8f0',
                    maxHeight: '200px',
                  }}
                >
                  {JSON.stringify(version.config, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Compare View */}
      {compareMode && compareVersions && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
          }}
        >
          <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem', color: '#e2e8f0' }}>
            Comparing Version {compareVersions[0]} vs Version {compareVersions[1]}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {[compareVersions[0], compareVersions[1]].map((versionNum) => {
              const version = versions.find((v) => v.version === versionNum)
              return (
                <div key={versionNum}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.5rem', color: '#94a3b8' }}>
                    Version {versionNum}
                  </div>
                  <pre
                    style={{
                      background: '#0f172a',
                      padding: '0.75rem',
                      borderRadius: '0.375rem',
                      overflow: 'auto',
                      fontSize: '0.65rem',
                      color: '#e2e8f0',
                      maxHeight: '200px',
                    }}
                  >
                    {JSON.stringify(version?.config, null, 2)}
                  </pre>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {sortedVersions.length === 0 && (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            background: '#1e293b',
            border: '1px dashed #334155',
            borderRadius: '0.5rem',
            color: '#94a3b8',
          }}
        >
          No version history available
        </div>
      )}
    </div>
  )
}
