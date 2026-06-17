import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

// Generic support-case thread, keyed by case id (works for any case type:
// dispute, review appeal, …).
export const useCase = (caseId: string, pollInterval: number = 10_000) =>
  useQuery({
    queryKey: ['case', caseId],
    queryFn: () =>
      unwrap(api.GET('/v1/cases/{id}', { params: { path: { id: caseId } } })),
    retry: defaultRetry,
    enabled: !!caseId,
    refetchInterval: (query) => {
      if (!query.state.data?.is_open) return false
      const hidden = typeof document !== 'undefined' && document.hidden
      return hidden ? Math.max(pollInterval, 30_000) : pollInterval
    },
    refetchIntervalInBackground: true,
  })

export const useReplyToCase = (caseId: string) =>
  useMutation({
    mutationFn: ({ body, file_ids }: { body?: string; file_ids?: string[] }) =>
      api.POST('/v1/cases/{id}/messages', {
        params: { path: { id: caseId } },
        body: { body: body || null, file_ids },
      }),
    onSuccess: async (result) => {
      if (result.error) return
      getQueryClient().invalidateQueries({ queryKey: ['case', caseId] })
    },
  })
