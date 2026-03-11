import { Download, FileJson, FileText } from 'lucide-react'
import { useState } from 'react'

export interface ExportButtonProps {
  data: any[]
  filename: string
  formats?: ('csv' | 'json')[]
}

export default function ExportButton({ data, filename, formats = ['csv', 'json'] }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  const exportAsCSV = () => {
    if (!data || data.length === 0) {
      alert('No data to export')
      return
    }

    const headers = Object.keys(data[0])
    const csv = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((header) => {
          const value = row[header]
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`
          }
          return value
        }).join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    setIsOpen(false)
  }

  const exportAsJSON = () => {
    if (!data || data.length === 0) {
      alert('No data to export')
      return
    }

    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.json`
    a.click()
    window.URL.revokeObjectURL(url)
    setIsOpen(false)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '0.5rem 1rem',
          background: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
        }}
      >
        <Download size={16} />
        Export
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '0.5rem',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '0.5rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
          zIndex: 10,
          minWidth: '150px',
        }}>
          {formats.includes('csv') && (
            <button
              onClick={exportAsCSV}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'transparent',
                color: '#e2e8f0',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                borderBottom: formats.includes('json') ? '1px solid #334155' : 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#334155')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <FileText size={16} />
              Export as CSV
            </button>
          )}
          {formats.includes('json') && (
            <button
              onClick={exportAsJSON}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'transparent',
                color: '#e2e8f0',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#334155')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <FileJson size={16} />
              Export as JSON
            </button>
          )}
        </div>
      )}
    </div>
  )
}
