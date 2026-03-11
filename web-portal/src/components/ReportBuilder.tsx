import { useState } from 'react'
import { Plus, Trash2, Save, Eye } from 'lucide-react'

export interface ReportMetric {
  id: string
  name: string
  type: 'count' | 'average' | 'sum' | 'percentage'
}

export interface ReportFilter {
  field: string
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than'
  value: string
}

export interface CustomReport {
  id: string
  name: string
  description: string
  metrics: ReportMetric[]
  filters: ReportFilter[]
  visualization: 'table' | 'chart' | 'both'
  dateRange: number
}

export interface ReportBuilderProps {
  availableMetrics: ReportMetric[]
  onSave: (report: CustomReport) => void
  onPreview?: (report: CustomReport) => void
  disabled?: boolean
}

const VISUALIZATION_TYPES = [
  { value: 'table', label: 'Table' },
  { value: 'chart', label: 'Chart' },
  { value: 'both', label: 'Both' },
]

const FILTER_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
]

export default function ReportBuilder({
  availableMetrics = [],
  onSave,
  onPreview,
  disabled = false,
}: ReportBuilderProps) {
  const [reportName, setReportName] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([])
  const [filters, setFilters] = useState<ReportFilter[]>([])
  const [visualization, setVisualization] = useState<'table' | 'chart' | 'both'>('table')
  const [dateRange, setDateRange] = useState(30)
  const [error, setError] = useState('')
  const [newFilterField, setNewFilterField] = useState('')
  const [newFilterOperator, setNewFilterOperator] = useState<'equals' | 'contains' | 'greater_than' | 'less_than'>(
    'equals'
  )
  const [newFilterValue, setNewFilterValue] = useState('')

  const addMetric = (metricId: string) => {
    if (!selectedMetrics.includes(metricId)) {
      setSelectedMetrics([...selectedMetrics, metricId])
    }
  }

  const removeMetric = (metricId: string) => {
    setSelectedMetrics(selectedMetrics.filter((m) => m !== metricId))
  }

  const addFilter = () => {
    setError('')

    if (!newFilterField || !newFilterValue) {
      setError('Please fill in all filter fields')
      return
    }

    const newFilter: ReportFilter = {
      field: newFilterField,
      operator: newFilterOperator,
      value: newFilterValue,
    }

    setFilters([...filters, newFilter])
    setNewFilterField('')
    setNewFilterValue('')
  }

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    setError('')

    if (!reportName.trim()) {
      setError('Report name is required')
      return
    }

    if (selectedMetrics.length === 0) {
      setError('Please select at least one metric')
      return
    }

    const report: CustomReport = {
      id: `report-${Date.now()}`,
      name: reportName,
      description: reportDescription,
      metrics: selectedMetrics.map((id) => availableMetrics.find((m) => m.id === id)!),
      filters,
      visualization,
      dateRange,
    }

    onSave(report)
    resetForm()
  }

  const handlePreview = () => {
    if (selectedMetrics.length === 0) {
      setError('Please select at least one metric')
      return
    }

    const report: CustomReport = {
      id: `preview-${Date.now()}`,
      name: reportName || 'Preview',
      description: reportDescription,
      metrics: selectedMetrics.map((id) => availableMetrics.find((m) => m.id === id)!),
      filters,
      visualization,
      dateRange,
    }

    onPreview?.(report)
  }

  const resetForm = () => {
    setReportName('')
    setReportDescription('')
    setSelectedMetrics([])
    setFilters([])
    setVisualization('table')
    setDateRange(30)
    setError('')
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        Custom Report Builder
      </h2>

      <div
        style={{
          padding: '1.5rem',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '0.5rem',
        }}
      >
        {/* Report Name */}
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
            placeholder="e.g., Monthly Security Report"
            disabled={disabled}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              background: '#0f172a',
              border: error && !reportName ? '1px solid #ef4444' : '1px solid #334155',
              borderRadius: '0.375rem',
              color: '#e2e8f0',
              fontSize: '0.875rem',
              opacity: disabled ? 0.5 : 1,
            }}
          />
        </div>

        {/* Report Description */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
            Description
          </label>
          <textarea
            value={reportDescription}
            onChange={(e) => setReportDescription(e.target.value)}
            placeholder="Optional description for this report"
            disabled={disabled}
            style={{
              width: '100%',
              minHeight: '60px',
              padding: '0.5rem 0.75rem',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
              color: '#e2e8f0',
              fontSize: '0.875rem',
              resize: 'vertical',
              opacity: disabled ? 0.5 : 1,
            }}
          />
        </div>

        {/* Metrics Selection */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
            Metrics *
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
            {availableMetrics.map((metric) => (
              <button
                key={metric.id}
                onClick={() => (selectedMetrics.includes(metric.id) ? removeMetric(metric.id) : addMetric(metric.id))}
                disabled={disabled}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: selectedMetrics.includes(metric.id) ? '#3b82f6' : '#334155',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  opacity: disabled ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {metric.name}
              </button>
            ))}
          </div>
          {selectedMetrics.length > 0 && (
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {selectedMetrics.length} metric(s) selected
            </div>
          )}
        </div>

        {/* Visualization Type */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
            Visualization
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {VISUALIZATION_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setVisualization(type.value as 'table' | 'chart' | 'both')}
                disabled={disabled}
                style={{
                  padding: '0.5rem',
                  background: visualization === type.value ? '#3b82f6' : '#334155',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
            Date Range (days)
          </label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            disabled={disabled}
            style={{
              width: '100%',
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
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {/* Filters */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
            Filters (Optional)
          </label>

          {/* Add Filter Form */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="text"
              value={newFilterField}
              onChange={(e) => setNewFilterField(e.target.value)}
              placeholder="Field"
              disabled={disabled}
              style={{
                padding: '0.5rem 0.75rem',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '0.375rem',
                color: '#e2e8f0',
                fontSize: '0.875rem',
                opacity: disabled ? 0.5 : 1,
              }}
            />
            <select
              value={newFilterOperator}
              onChange={(e) => setNewFilterOperator(e.target.value as any)}
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
              {FILTER_OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newFilterValue}
              onChange={(e) => setNewFilterValue(e.target.value)}
              placeholder="Value"
              disabled={disabled}
              style={{
                padding: '0.5rem 0.75rem',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '0.375rem',
                color: '#e2e8f0',
                fontSize: '0.875rem',
                opacity: disabled ? 0.5 : 1,
              }}
            />
            <button
              onClick={addFilter}
              disabled={disabled || !newFilterField || !newFilterValue}
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
                opacity: disabled || !newFilterField || !newFilterValue ? 0.5 : 1,
              }}
            >
              <Plus size={16} />
              Add
            </button>
          </div>

          {/* Filters List */}
          {filters.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filters.map((filter, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: '#e2e8f0',
                  }}
                >
                  <span>
                    {filter.field} {filter.operator} {filter.value}
                  </span>
                  <button
                    onClick={() => removeFilter(idx)}
                    disabled={disabled}
                    style={{
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
              ))}
            </div>
          )}
        </div>

        {/* Error Message */}
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

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleSave}
            disabled={disabled}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Save size={16} />
            Save Report
          </button>
          {onPreview && (
            <button
              onClick={handlePreview}
              disabled={disabled}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <Eye size={16} />
              Preview
            </button>
          )}
          <button
            onClick={resetForm}
            disabled={disabled}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: '#334155',
              color: '#e2e8f0',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
