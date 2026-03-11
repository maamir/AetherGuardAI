import { useState } from 'react'
import { Plus, Trash2, Clock, Mail, AlertCircle } from 'lucide-react'

export interface ScheduledReport {
  id: string
  name: string
  frequency: 'daily' | 'weekly' | 'monthly'
  recipients: string[]
  nextRun: string
  lastRun?: string
  isActive: boolean
}

export interface ScheduledReportsProps {
  reports: ScheduledReport[]
  onAdd: (report: ScheduledReport) => void
  onDelete: (reportId: string) => void
  onToggle: (reportId: string, isActive: boolean) => void
  disabled?: boolean
}

const FREQUENCIES = [
  { value: 'daily', label: 'Daily', icon: '📅' },
  { value: 'weekly', label: 'Weekly', icon: '📆' },
  { value: 'monthly', label: 'Monthly', icon: '📊' },
]

export default function ScheduledReports({
  reports = [],
  onAdd,
  onDelete,
  onToggle,
  disabled = false,
}: ScheduledReportsProps) {
  const [showForm, setShowForm] = useState(false)
  const [reportName, setReportName] = useState('')
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [recipients, setRecipients] = useState('')
  const [error, setError] = useState('')

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleAddReport = () => {
    setError('')

    if (!reportName.trim()) {
      setError('Report name is required')
      return
    }

    if (!recipients.trim()) {
      setError('At least one recipient is required')
      return
    }

    const recipientList = recipients
      .split(',')
      .map((r) => r.trim())
      .filter((r) => r)

    for (const recipient of recipientList) {
      if (!validateEmail(recipient)) {
        setError(`Invalid email: ${recipient}`)
        return
      }
    }

    const newReport: ScheduledReport = {
      id: `scheduled-${Date.now()}`,
      name: reportName,
      frequency,
      recipients: recipientList,
      nextRun: new Date().toISOString(),
      isActive: true,
    }

    onAdd(newReport)
    resetForm()
  }

  const resetForm = () => {
    setReportName('')
    setFrequency('daily')
    setRecipients('')
    setError('')
    setShowForm(false)
  }

  const getNextRunText = (frequency: string): string => {
    const now = new Date()
    switch (frequency) {
      case 'daily':
        return 'Tomorrow at 9:00 AM'
      case 'weekly':
        return 'Next Monday at 9:00 AM'
      case 'monthly':
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        return `${nextMonth.toLocaleDateString()} at 9:00 AM`
      default:
        return 'Unknown'
    }
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Scheduled Reports</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            disabled={disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Plus size={16} />
            Schedule Report
          </button>
        )}
      </div>

      {/* Add Report Form */}
      {showForm && (
        <div
          style={{
            padding: '1rem',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              Report Name *
            </label>
            <input
              type="text"
              value={reportName}
              onChange={(e) => {
                setReportName(e.target.value)
                setError('')
              }}
              placeholder="e.g., Weekly Security Report"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                background: '#0f172a',
                border: error && !reportName ? '1px solid #ef4444' : '1px solid #334155',
                borderRadius: '0.375rem',
                color: '#e2e8f0',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              Frequency
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {FREQUENCIES.map((freq) => (
                <button
                  key={freq.value}
                  onClick={() => setFrequency(freq.value as any)}
                  style={{
                    padding: '0.5rem',
                    background: frequency === freq.value ? '#3b82f6' : '#334155',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  {freq.icon} {freq.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              Recipients (comma-separated) *
            </label>
            <textarea
              value={recipients}
              onChange={(e) => {
                setRecipients(e.target.value)
                setError('')
              }}
              placeholder="e.g., admin@example.com, manager@example.com"
              style={{
                width: '100%',
                minHeight: '60px',
                padding: '0.5rem 0.75rem',
                background: '#0f172a',
                border: error && !recipients ? '1px solid #ef4444' : '1px solid #334155',
                borderRadius: '0.375rem',
                color: '#e2e8f0',
                fontSize: '0.875rem',
                resize: 'vertical',
              }}
            />
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

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleAddReport}
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
              Schedule
            </button>
            <button
              onClick={resetForm}
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

      {/* Reports List */}
      {reports.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {reports.map((report) => (
            <div
              key={report.id}
              style={{
                padding: '1rem',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '0.25rem' }}>
                    {report.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <span>{FREQUENCIES.find((f) => f.value === report.frequency)?.label}</span>
                    <span>•</span>
                    <span>{report.recipients.length} recipient(s)</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => onToggle(report.id, !report.isActive)}
                    disabled={disabled}
                    style={{
                      padding: '0.25rem 0.75rem',
                      background: report.isActive ? '#10b98120' : '#ef444420',
                      color: report.isActive ? '#10b981' : '#ef4444',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      opacity: disabled ? 0.5 : 1,
                    }}
                  >
                    {report.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => onDelete(report.id)}
                    disabled={disabled}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: 'transparent',
                      color: '#ef4444',
                      border: 'none',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8' }}>
                  <Clock size={14} />
                  Next run: {getNextRunText(report.frequency)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8' }}>
                  <Mail size={14} />
                  {report.recipients.join(', ')}
                </div>
              </div>

              {report.lastRun && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#cbd5e1' }}>
                  Last sent: {new Date(report.lastRun).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
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
          No scheduled reports yet. Create one to get started.
        </div>
      )}
    </div>
  )
}
