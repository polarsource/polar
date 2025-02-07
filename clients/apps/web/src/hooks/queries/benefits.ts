import { useMutation, useQuery } from '@tanstack/react-query'

import { queryClient } from '@/utils/api'
import { api } from '@/utils/client'
import { components, operations, unwrap } from '@polar-sh/client'
import { defaultRetry } from './retry'

const _invalidateBenefitsQueries = ({
  id,
  orgId,
}: {
  id?: string
  orgId?: string
}) => {
  if (id) {
    queryClient.invalidateQueries({
      queryKey: ['benefits', 'id', id],
    })
  }

  if (orgId) {
    queryClient.invalidateQueries({
      queryKey: ['benefits', 'organization', orgId],
    })
  }

  queryClient.invalidateQueries({
    queryKey: ['subscriptionTiers'],
  })
}

export const useBenefits = (
  orgId?: string,
  limit = 30,
  type?: components['schemas']['BenefitType'],
) =>
  useQuery({
    queryKey: ['benefits', 'organization', orgId, { type }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/benefits/', {
          params: {
            query: {
              organization_id: orgId,
              limit,
              type,
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!orgId,
  })

export const useBenefit = (id?: string) =>
  useQuery({
    queryKey: ['benefits', 'id', id],
    queryFn: () => {
      return unwrap(
        api.GET('/v1/benefits/{id}', {
          params: {
            path: {
              id: id ?? '',
            },
          },
        }),
      )
    },
    retry: defaultRetry,
    enabled: !!id,
  })

export const useUpdateBenefit = (orgId?: string) =>
  useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: operations['benefits:update']['requestBody']['content']['application/json']
    }) => {
      return api.PATCH('/v1/benefits/{id}', {
        params: {
          path: {
            id,
          },
        },
        body,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      const { data, error } = result
      if (error) {
        return
      }
      _invalidateBenefitsQueries({ id: data.id, orgId })
    },
  })

export const useCreateBenefit = (orgId?: string) =>
  useMutation({
    mutationFn: (body: components['schemas']['BenefitCreate']) => {
      return api.POST('/v1/benefits/', { body })
    },
    onSuccess: (result, _variables, _ctx) => {
      const { data, error } = result
      if (error) {
        return
      }
      _invalidateBenefitsQueries({ id: data.id, orgId })
    },
  })

export const useDeleteBenefit = (orgId?: string) =>
  useMutation({
    mutationFn: ({ id }: { id: string }) => {
      return api.DELETE('/v1/benefits/{id}', {
        params: {
          path: {
            id,
          },
        },
      })
    },
    onSuccess: (result, variables, _ctx) => {
      if (result.error) {
        return
      }
      _invalidateBenefitsQueries({ id: variables.id, orgId })
    },
  })
