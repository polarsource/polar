import { api, queryClient } from '@/utils/api'
import { RefundsApiCreateRequest } from '@polar-sh/api';
import { useMutation, useQuery } from "@tanstack/react-query";
import { defaultRetry } from './retry';

export const useRefunds = (orderId?: string) => useQuery({
  queryKey: ['refunds', orderId],
  queryFn: async () => api.refunds.list({ orderId }),
  enabled: !!orderId,
})

export const useCreateRefund = () => useMutation({
  mutationFn: async (data: RefundsApiCreateRequest) => api.refunds.create(data),
  onSuccess: async (_result, _variables) => {
    queryClient.invalidateQueries({
      queryKey: ['refunds'],
    })

    queryClient.invalidateQueries({
      queryKey: ['order', _variables.body.order_id]
    })

    queryClient.invalidateQueries({
      queryKey: ['orders']
    })
  },
  retry: defaultRetry,
})
