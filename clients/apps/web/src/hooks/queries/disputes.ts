import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useDispute = (id: string) =>
  useQuery({
    queryKey: ['disputes', { id }],
    queryFn: () =>
      unwrap(api.GET('/v1/disputes/{id}', { params: { path: { id } } })),
    retry: defaultRetry,
    enabled: !!id,
  })

export const useAcceptDispute = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.POST('/v1/disputes/{id}/accept', { params: { path: { id } } }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] })
    },
  })
}

export const useCounterDispute = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: schemas['DisputeCounter']
    }) =>
      unwrap(
        api.POST('/v1/disputes/{id}/counter', {
          params: { path: { id } },
          body,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] })
    },
  })
}

export const useDisputes = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['disputes:list']['parameters']['query']>,
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: ['disputes', { organizationId, parameters }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/disputes/', {
          params: {
            query: { organization_id: organizationId, ...(parameters || {}) },
          },
        }),
      ),
    retry: defaultRetry,
  })
