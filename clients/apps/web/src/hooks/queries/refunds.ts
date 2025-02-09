import { queryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { components, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useRefunds = (orderId?: string) =>
  useQuery({
    queryKey: ['refunds', orderId],
    queryFn: async () =>
      unwrap(
        api.GET('/v1/refunds/', { params: { query: { order_id: orderId } } }),
      ),
    enabled: !!orderId,
  })

export const useCreateRefund = () =>
  useMutation({
    mutationFn: async (body: components['schemas']['RefundCreate']) =>
      api.POST('/v1/refunds/', { body }),
    onSuccess: async (result, variables) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['refunds'],
      })

      queryClient.invalidateQueries({
        queryKey: ['order', variables.order_id],
      })

      queryClient.invalidateQueries({
        queryKey: ['orders'],
      })
    },
    retry: defaultRetry,
  })
