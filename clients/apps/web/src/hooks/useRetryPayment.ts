import { useState } from 'react'
import { toast } from '@/components/Toast/use-toast'

export const useRetryPayment = (customerSessionToken: string) => {
  const [retryingOrderIds, setRetryingOrderIds] = useState<Set<string>>(new Set())

  const retryPayment = async (orderId: string) => {
    setRetryingOrderIds(prev => new Set(prev).add(orderId))
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/customer-portal/orders/${orderId}/retry-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${customerSessionToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.ok) {
        toast({
          title: 'Payment retry initiated',
          description: 'Payment retry initiated successfully. Please refresh the page in a few moments to see the updated status.',
          variant: 'default',
        })
      } else if (response.status === 409) {
        toast({
          title: 'Payment in progress',
          description: 'Payment for this order is already in progress.',
          variant: 'error',
        })
      } else if (response.status === 422) {
        toast({
          title: 'Cannot retry payment',
          description: 'This order is not eligible for payment retry.',
          variant: 'error',
        })
      } else {
        throw new Error('Failed to retry payment')
      }
    } catch (error) {
      console.error('Error retrying payment:', error)
      toast({
        title: 'Error',
        description: 'Failed to retry payment. Please try again later.',
        variant: 'error',
      })
    } finally {
      setRetryingOrderIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(orderId)
        return newSet
      })
    }
  }

  const isRetrying = (orderId: string) => retryingOrderIds.has(orderId)

  return {
    retryPayment,
    isRetrying,
  }
}
