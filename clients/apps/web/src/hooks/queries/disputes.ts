import { api } from '@/utils/client'
import { operations, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useDispute = (id: string) =>
  useQuery({
    queryKey: ['disputes', { id }],
    queryFn: () =>
      unwrap(api.GET('/v1/disputes/{id}', { params: { path: { id } } })),
    retry: defaultRetry,
    enabled: !!id,
  })

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
