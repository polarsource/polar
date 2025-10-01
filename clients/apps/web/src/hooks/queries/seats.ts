import { getServerURL } from '@/utils/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export const useAssignSeatFromCheckout = (checkoutId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      email,
      metadata,
    }: {
      email: string
      metadata?: Record<string, any>
    }) => {
      const response = await fetch(
        `${getServerURL()}/v1/customer-seats`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            checkout_id: checkoutId,
            email,
            metadata,
          }),
        },
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || 'Failed to assign seat')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate relevant queries if needed
      queryClient.invalidateQueries({
        queryKey: ['checkouts', checkoutId],
      })
    },
  })
}
