import { api } from '@/utils/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useBankLinkingStatus = (accountId: string) => {
  return useQuery({
    queryKey: ['bankLinking', 'status', accountId],
    queryFn: async () => {
      const { data, error } = await api.GET(
        '/v1/bank-linking/status/{account_id}',
        {
          params: { path: { account_id: accountId } },
        },
      )
      if (error) throw error
      return data
    },
    enabled: !!accountId,
  })
}

export const useCreateBankLinkingSession = () => {
  return useMutation({
    mutationFn: async ({
      accountId,
      returnUrl,
    }: {
      accountId: string
      returnUrl: string
    }) => {
      const { data, error } = await api.POST('/v1/bank-linking/sessions', {
        body: {
          account_id: accountId,
          return_url: returnUrl,
        },
      })
      if (error) throw error
      return data
    },
  })
}

export const useCompleteBankLinking = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      accountId,
      financialConnectionsAccountId,
    }: {
      accountId: string
      financialConnectionsAccountId: string
    }) => {
      const { data, error } = await api.POST('/v1/bank-linking/complete', {
        body: {
          account_id: accountId,
          financial_connections_account_id: financialConnectionsAccountId,
        },
      })
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      // Invalidate status query
      queryClient.invalidateQueries({
        queryKey: ['bankLinking', 'status', variables.accountId],
      })
    },
  })
}

export const useDisconnectBankAccount = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await api.DELETE('/v1/bank-linking/{account_id}', {
        params: { path: { account_id: accountId } },
      })
      if (error) throw error
    },
    onSuccess: (_, accountId) => {
      // Invalidate status query
      queryClient.invalidateQueries({
        queryKey: ['bankLinking', 'status', accountId],
      })
    },
  })
}
