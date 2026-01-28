import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { defaultRetry } from './retry'

const queryClient = getQueryClient()

export const usePerks = (parameters?: {
  category?: string
  featured?: boolean
  page?: number
  limit?: number
}) =>
  useQuery({
    queryKey: ['perks', parameters],
    queryFn: () =>
      unwrap(
        api.GET('/v1/perks/', {
          params: {
            query: parameters,
          },
        }),
      ),
    retry: defaultRetry,
    placeholderData: keepPreviousData,
  })

export const usePerk = (perkId?: string) =>
  useQuery({
    queryKey: ['perks', 'id', perkId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/perks/{id}', {
          params: {
            path: { id: perkId! },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!perkId,
  })

export const useClaimPerk = () =>
  useMutation({
    mutationFn: (perkId: string) =>
      unwrap(
        api.POST('/v1/perks/{id}/claim', {
          params: {
            path: { id: perkId },
          },
        }),
      ),
    onSuccess: (_result, perkId) => {
      // Invalidate perk queries to update claim counts
      queryClient.invalidateQueries({
        queryKey: ['perks'],
      })
      queryClient.invalidateQueries({
        queryKey: ['perks', 'id', perkId],
      })
    },
  })
