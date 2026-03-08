/**
 * WebSocket Hook for Real-Time Updates
 * 
 * Provides real-time communication with the backend for live metrics,
 * detection events, and system notifications.
 */

import { useEffect, useRef, useState, useCallback } from 'react'

export interface WebSocketMessage {
  type: string
  data: any
  timestamp: string
}

export interface UseWebSocketOptions {
  url: string
  reconnect?: boolean
  reconnectInterval?: number
  onMessage?: (message: WebSocketMessage) => void
  onError?: (error: Event) => void
  onOpen?: () => void
  onClose?: () => void
}

export interface UseWebSocketReturn {
  isConnected: boolean
  lastMessage: WebSocketMessage | null
  send: (message: any) => void
  disconnect: () => void
  reconnect: () => void
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    url,
    reconnect = true,
    reconnectInterval = 3000,
    onMessage,
    onError,
    onOpen,
    onClose,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const shouldReconnectRef = useRef(reconnect)

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url)

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        onOpen?.()
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          setLastMessage(message)
          onMessage?.(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        onError?.(error)
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        onClose?.()

        // Attempt reconnection
        if (shouldReconnectRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...')
            connect()
          }, reconnectInterval)
        }
      }

      wsRef.current = ws
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
    }
  }, [url, reconnectInterval, onMessage, onError, onOpen, onClose])

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const reconnectManually = useCallback(() => {
    disconnect()
    shouldReconnectRef.current = true
    connect()
  }, [connect, disconnect])

  const send = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected')
    }
  }, [])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    isConnected,
    lastMessage,
    send,
    disconnect,
    reconnect: reconnectManually,
  }
}

/**
 * Hook for subscribing to specific event types
 */
export function useWebSocketSubscription(
  url: string,
  eventType: string,
  onEvent: (data: any) => void
) {
  const { isConnected, lastMessage } = useWebSocket({
    url,
    onMessage: (message) => {
      if (message.type === eventType) {
        onEvent(message.data)
      }
    },
  })

  return { isConnected }
}

/**
 * Hook for real-time metrics updates
 */
export function useRealTimeMetrics(url: string = 'ws://localhost:8080/ws/metrics') {
  const [metrics, setMetrics] = useState<any>(null)

  const { isConnected } = useWebSocket({
    url,
    onMessage: (message) => {
      if (message.type === 'metrics_update') {
        setMetrics(message.data)
      }
    },
  })

  return { metrics, isConnected }
}

/**
 * Hook for real-time detection events
 */
export function useDetectionEvents(url: string = 'ws://localhost:8080/ws/detections') {
  const [events, setEvents] = useState<any[]>([])

  const { isConnected } = useWebSocket({
    url,
    onMessage: (message) => {
      if (message.type === 'detection_event') {
        setEvents((prev) => [message.data, ...prev].slice(0, 100)) // Keep last 100
      }
    },
  })

  const clearEvents = useCallback(() => {
    setEvents([])
  }, [])

  return { events, isConnected, clearEvents }
}
