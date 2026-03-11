import { useState } from 'react'
import { Calendar } from 'lucide-react'

export interface DateRange {
  startDate: Date
  endDate: Date
  label: string
}

export interface DateRangePickerProps {
  value: number // days
  onChange: (days: number) => void
  showCustom?: boolean
}

export default function DateRangePicker({ value, onChange, showCustom = true }: DateRangePickerProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customDays, setCustomDays] = useState(value)

  const presets = [
    { label: 'Today', days: 1 },
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
  ]

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <Calendar size={18} color="#94a3b8" />
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          padding: '0.5rem 1rem',
          background: '#1e293b',
          color: '#e2e8f0',
          border: '1px solid #334155',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        {presets.map((preset) => (
          <option key={preset.days} value={preset.days}>
            {preset.label}
          </option>
        ))}
        {showCustom && <option value={-1}>Custom...</option>}
      </select>

      {showCustom && value === -1 && (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          padding: '0.5rem 1rem',
          background: '#1e293b',
          borderRadius: '0.5rem',
          border: '1px solid #334155',
        }}>
          <input
            type="number"
            min="1"
            max="365"
            value={customDays}
            onChange={(e) => setCustomDays(Number(e.target.value))}
            style={{
              width: '60px',
              padding: '0.25rem 0.5rem',
              background: '#0f172a',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: '0.25rem',
            }}
          />
          <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>days</span>
          <button
            onClick={() => onChange(customDays)}
            style={{
              padding: '0.25rem 0.75rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
