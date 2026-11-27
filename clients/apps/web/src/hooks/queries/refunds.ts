import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

// The most the API returns in one page, so an order's refunds come whole.
const REFUNDS_LIMIT = 100

export const useRefunds = (orderId?: string) =>
  useQuery({
    queryKey: ['refunds', orderId],
    queryFn: async () =>
      unwrap(
        api.GET('/v1/refunds/', {
          params: { query: { order_id: orderId, limit: REFUNDS_LIMIT } },
        }),
      ),
    enabled: !!orderId,
  })

export const useCreateRefund = () =>
  useMutation({
    mutationFn: async (body: schemas['RefundCreate']) =>
      api.POST('/v1/refunds/', { body }),
    onSuccess: async (result, variables) => {
      if (result.error) {
        return
      }
      const queryClient = getQueryClient()
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
