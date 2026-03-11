import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { adminApi } from '../services/api'

interface AuditLog {
  id: string
  action: string
  userId: string
  tenantId: string
  timestamp: string
  details: string
  [key: string]: any
}

interface AuditLogsData {
  logs: AuditLog[]
  total: number
}

export default function AuditLogs() {
  const [skip, setSkip] = useState(0)
  const [actionFilter, setActionFilter] = useState('')

  const { data: logsData, isLoading } = useQuery<AuditLogsData>({
    queryKey: ['audit-logs', skip, actionFilter],
    queryFn: () =>
      adminApi.getAuditLogs(skip, 50, {
        action: actionFilter || undefined,
      }),
  })

  const logs = logsData?.logs || []

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return '#10b981'
      case 'UPDATE':
        return '#3b82f6'
      case 'DELETE':
        return '#ef4444'
      case 'LOGIN':
        return '#f59e0b'
      default:
        return '#94a3b8'
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
        Audit Logs
      </h1>

      {/* Filters */}
      <div style={{ marginBottom: '1.5rem' }}>
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value)
            setSkip(0)
          }}
          style={{
            padding: '0.5rem 1rem',
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
            cursor: 'pointer',
          }}
        >
          <option value="">All Actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="LOGIN">Login</option>
        </select>
      </div>

      {/* Logs Table */}
      <div
        style={{
          background: '#1e293b',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            No audit logs found
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', background: '#0f172a' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600' }}>
                  Timestamp
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600' }}>
                  User
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600' }}>
                  Action
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600' }}>
                  Resource
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600' }}>
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#94a3b8' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                    {log.user_email}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        background: `${getActionColor(log.action)}20`,
                        color: getActionColor(log.action),
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                      }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#94a3b8' }}>
                    {log.resource_type}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#94a3b8' }}>
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
        <button
          onClick={() => setSkip(Math.max(0, skip - 50))}
          disabled={skip === 0}
          style={{
            padding: '0.5rem 1rem',
            background: skip === 0 ? '#334155' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: skip === 0 ? 'not-allowed' : 'pointer',
            opacity: skip === 0 ? 0.5 : 1,
          }}
        >
          Previous
        </button>
        <span style={{ color: '#94a3b8' }}>
          Page {Math.floor(skip / 50) + 1}
        </span>
        <button
          onClick={() => setSkip(skip + 50)}
          disabled={logs.length < 50}
          style={{
            padding: '0.5rem 1rem',
            background: logs.length < 50 ? '#334155' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: logs.length < 50 ? 'not-allowed' : 'pointer',
            opacity: logs.length < 50 ? 0.5 : 1,
          }}
        >
          Next
        </button>
      </div>
    </div>
  )
}
