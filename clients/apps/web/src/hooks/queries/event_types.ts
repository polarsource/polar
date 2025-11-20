import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { useMutation } from '@tanstack/react-query'

export const useUpdateEventType = (id: string) =>
  useMutation({
    mutationFn: (body: schemas['EventTypeUpdate']) =>
      api.PATCH('/v1/event_types/{id}', {
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
        queryKey: ['eventNames', data.organization_id],
      })
      queryClient.invalidateQueries({
        queryKey: ['eventHierarchyStats', data.organization_id],
      })
    },
  })
