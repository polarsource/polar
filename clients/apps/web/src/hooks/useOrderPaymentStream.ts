import { useEffect, useRef, useState } from 'react'

interface PaymentStatusEvent {
  status: 'succeeded' | 'failed' | 'requires_action' | 'processing'
  error?: string
  payment_intent_id?: string
}

interface UseOrderPaymentStreamProps {
  orderId: string
  customerSessionToken: string
  enabled?: boolean
  onPaymentUpdate?: (event: PaymentStatusEvent) => void
}

export const useOrderPaymentStream = ({
  orderId,
  customerSessionToken,
  enabled = true,
  onPaymentUpdate,
}: UseOrderPaymentStreamProps) => {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [lastEvent, setLastEvent] = useState<PaymentStatusEvent | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const connect = () => {
    if (!enabled || !orderId || !customerSessionToken) return

    try {
      setConnectionStatus('connecting')
      
      const eventSource = new EventSource(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/customer-portal/orders/${orderId}/payment-stream`,
        {
          // Note: EventSource doesn't support custom headers directly
          // We'll need to pass the token as a query parameter or use a different approach
          withCredentials: true,
        }
      )

      eventSource.onopen = () => {
        console.log('Payment stream connected for order:', orderId)
        setConnectionStatus('connected')
        reconnectAttempts.current = 0
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('Payment stream event:', data)
          
          if (data.key?.startsWith('order.payment.')) {
            const eventType = data.key.split('.').pop()
            const payload = data.payload
            
            const paymentEvent: PaymentStatusEvent = {
              status: eventType === 'succeeded' ? 'succeeded' : 
                     eventType === 'failed' ? 'failed' : 'processing',
              error: payload.error,
              payment_intent_id: payload.payment_intent_id,
            }
            
            setLastEvent(paymentEvent)
            onPaymentUpdate?.(paymentEvent)
          }
        } catch (error) {
          console.error('Error parsing payment stream event:', error)
        }
      }

      eventSource.onerror = () => {
        console.error('Payment stream connection error')
        setConnectionStatus('error')
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000 // 1s, 2s, 4s, 8s, 16s
          reconnectAttempts.current++
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Reconnecting payment stream (attempt ${reconnectAttempts.current})...`)
            eventSource.close()
            connect()
          }, delay)
        } else {
          console.error('Max reconnection attempts reached for payment stream')
          setConnectionStatus('error')
        }
      }

      eventSourceRef.current = eventSource

    } catch (error) {
      console.error('Failed to establish payment stream connection:', error)
      setConnectionStatus('error')
    }
  }

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    setConnectionStatus('disconnected')
  }

  // Polling fallback if SSE fails
  const startPollingFallback = async () => {
    console.log('Starting polling fallback for payment status...')
    
    const poll = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/customer-portal/orders/${orderId}/payment-status`,
          {
            headers: {
              'Authorization': `Bearer ${customerSessionToken}`,
            },
          }
        )
        
        if (response.ok) {
          const status = await response.json()
          
          // Only notify if status changed
          if (status.status !== lastEvent?.status) {
            const paymentEvent: PaymentStatusEvent = {
              status: status.status,
              error: status.error,
            }
            
            setLastEvent(paymentEvent)
            onPaymentUpdate?.(paymentEvent)
          }
          
          // Stop polling if payment is complete
          if (status.status === 'succeeded' || status.status === 'failed') {
            return
          }
        }
      } catch (error) {
        console.error('Polling payment status error:', error)
      }
      
      // Continue polling every 2 seconds
      setTimeout(poll, 2000)
    }
    
    // Start polling after 5 seconds if SSE hasn't connected
    setTimeout(() => {
      if (connectionStatus === 'error') {
        poll()
      }
    }, 5000)
  }

  useEffect(() => {
    if (enabled) {
      connect()
      
      // Start fallback polling if connection fails
      if (connectionStatus === 'error') {
        startPollingFallback()
      }
    }

    return () => {
      disconnect()
    }
  }, [enabled, orderId, customerSessionToken])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])

  return {
    connectionStatus,
    lastEvent,
    connect,
    disconnect,
  }
}