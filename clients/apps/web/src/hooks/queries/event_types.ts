import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useEventTypes = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['event-types:list']['parameters']['query']>,
    'organization_id'
  >,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ['eventTypes', organizationId, { ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/event-types/', {
          params: {
            query: { organization_id: organizationId, ...(parameters || {}) },
          },
        }),
      ),
    retry: defaultRetry,
    enabled,
  })
}

export const useUpdateEventType = (id: string) =>
  useMutation({
    mutationFn: (body: schemas['EventTypeUpdate']) =>
      api.PATCH('/v1/event-types/{id}', {
        params: { path: { id } },
        body,
      }),
    onSuccess: async (result, _variables, _ctx) => {
      const { data, error } = result
      if (error) {
        return
      }
      if (!data?.organization_id) {
        return
      }

      const queryClient = getQueryClient()
      queryClient.invalidateQueries({
        queryKey: ['eventTypes', data.organization_id],
      })
      queryClient.invalidateQueries({
        queryKey: ['eventNames', data.organization_id],
      })
      queryClient.invalidateQueries({
        queryKey: ['eventHierarchyStats', data.organization_id],
      })
      queryClient.invalidateQueries({
        queryKey: ['events', 'infinite'],
      })
      queryClient.invalidateQueries({
        queryKey: ['events', data.organization_id],
      })
      queryClient.invalidateQueries({
        queryKey: ['event', data.organization_id],
      })
    },
  })
