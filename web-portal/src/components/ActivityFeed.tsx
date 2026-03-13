import { useQuery } from '@tanstack/react-query'
import { Clock, Shield, Key, Server, FileText, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { api } from '../services/api'

interface Activity {
  id: string
  type: string
  description: string
  user?: string
  timestamp: string
  metadata?: Record<string, any>
  severity?: 'info' | 'warning' | 'error' | 'success'
}

interface ActivityFeedProps {
  limit?: number
  types?: string[]
  showFilters?: boolean
}

export default function ActivityFeed({ limit = 10, types, showFilters = false }: ActivityFeedProps) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities', limit, types],
    queryFn: () => api.getActivities(limit, types),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const getActivityIcon = (type: string) => {
    if (type.startsWith('detection_')) return Shield
    if (type.startsWith('provider_')) return Server
    if (type.startsWith('api_key_')) return Key
    if (type.startsWith('policy_')) return FileText
    if (type.includes('_failed') || type.includes('_error')) return XCircle
    if (type.includes('_success') || type.includes('_completed')) return CheckCircle
    if (type.includes('_warning') || type.includes('_alert')) return AlertTriangle
    return Clock
  }

  const getActivityColor = (type: string, severity?: string) => {
    if (severity === 'error' || type.includes('_failed')) return '#ef4444'
    if (severity === 'warning' || type.includes('_warning')) return '#f59e0b'
    if (severity === 'success' || type.includes('_success')) return '#10b981'
    if (type.startsWith('detection_')) return '#f87171'
    if (type.startsWith('provider_')) return '#60a5fa'
    if (type.startsWith('api_key_')) return '#a78bfa'
    if (type.startsWith('policy_')) return '#fbbf24'
    return '#94a3b8'
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8' }}>Loading activities...</p>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Clock size={48} color="#94a3b8" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
        <p style={{ color: '#94a3b8' }}>No recent activities</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {activities.map((activity: Activity) => {
        const Icon = getActivityIcon(activity.type)
        const color = getActivityColor(activity.type, activity.severity)

        return (
          <div
            key={activity.id}
            style={{
              display: 'flex',
              alignItems: 'start',
              gap: '0.75rem',
              padding: '0.75rem',
              background: '#0f172a',
              borderRadius: '0.5rem',
              borderLeft: `3px solid ${color}`,
            }}
          >
            <div
              style={{
                padding: '0.5rem',
                background: `${color}20`,
                borderRadius: '0.375rem',
                flexShrink: 0,
              }}
            >
              <Icon size={16} color={color} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                {activity.description}
              </p>
              {activity.user && (
                <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  by {activity.user}
                </p>
              )}
            </div>

            <div style={{ fontSize: '0.75rem', color: '#64748b', flexShrink: 0 }}>
              {formatTimestamp(activity.timestamp)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
