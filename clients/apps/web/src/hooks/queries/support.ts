import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useSupportCases = (organizationId: string) =>
  useQuery({
    queryKey: ['supportCases', organizationId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/support/cases', {
          params: { path: { id: organizationId } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useSupportCase = (
  organizationId: string,
  caseId: string,
  // Real-time updates come via SSE (useOrganizationSSE); this slow poll is
  // only a fallback for dropped connections.
  pollInterval: number = 60_000,
) =>
  useQuery({
    queryKey: ['supportCase', organizationId, caseId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/support/cases/{case_id}', {
          params: { path: { id: organizationId, case_id: caseId } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId && !!caseId,
    refetchInterval: (query) => {
      if (!query.state.data?.is_open) return false
      const hidden = typeof document !== 'undefined' && document.hidden
      return hidden ? Math.max(pollInterval, 30_000) : pollInterval
    },
    refetchIntervalInBackground: true,
  })

export const useReplySupportCase = (organizationId: string, caseId: string) =>
  useMutation({
    mutationFn: ({ body, file_ids }: { body?: string; file_ids?: string[] }) =>
      api.POST('/v1/organizations/{id}/support/cases/{case_id}/messages', {
        params: { path: { id: organizationId, case_id: caseId } },
        body: { body: body || null, file_ids },
      }),
    onSuccess: async (result) => {
      if (result.error) return
      getQueryClient().invalidateQueries({
        queryKey: ['supportCase', organizationId, caseId],
      })
      getQueryClient().invalidateQueries({
        queryKey: ['supportCases', organizationId],
      })
    },
  })
