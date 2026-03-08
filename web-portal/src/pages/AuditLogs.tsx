export default function AuditLogs() {
  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
        Audit Logs
      </h1>
      <div style={{
        background: '#1e293b',
        padding: '2rem',
        borderRadius: '0.75rem',
        border: '1px solid #334155',
        textAlign: 'center',
      }}>
        <p style={{ color: '#94a3b8' }}>
          Audit log viewer coming soon. Logs are currently stored in QLDB.
        </p>
      </div>
    </div>
  )
}
