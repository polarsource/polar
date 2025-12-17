import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
} from '@tanstack/react-query'

import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { defaultRetry } from './retry'

const _invalidateBenefitsQueries = ({
  id,
  orgId,
}: {
  id?: string
  orgId?: string
}) => {
  const queryClient = getQueryClient()
  if (id) {
    queryClient.invalidateQueries({
      queryKey: ['benefits', 'id', id],
    })
  }

  if (orgId) {
    queryClient.invalidateQueries({
      queryKey: ['benefits', 'organization', orgId],
    })

    queryClient.invalidateQueries({
      queryKey: ['infinite', 'benefits', 'organization', orgId],
    })

    queryClient.invalidateQueries({
      queryKey: ['benefits', 'grants', id, orgId],
    })
  }

  queryClient.invalidateQueries({
    queryKey: ['subscriptionTiers'],
  })
}

export const useInfiniteBenefits = (
  orgId: string,
  parameters?: operations['benefits:list']['parameters']['query'],
) =>
  useInfiniteQuery({
    queryKey: ['infinite', 'benefits', 'organization', orgId, parameters],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/benefits/', {
          params: {
            query: {
              ...parameters,
              organization_id: orgId,
              page: pageParam,
            },
          },
        }),
      ),
    retry: defaultRetry,
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (
        lastPageParam === lastPage.pagination.max_page ||
        lastPage.items.length === 0
      ) {
        return null
      }

      return lastPageParam + 1
    },
  })

export const useBenefits = (
  orgId?: string,
  parameters?: operations['benefits:list']['parameters']['query'],
) =>
  useQuery({
    queryKey: ['benefits', 'organization', orgId, parameters],
    queryFn: () =>
      unwrap(
        api.GET('/v1/benefits/', {
          params: {
            query: {
              ...parameters,
              organization_id: orgId,
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!orgId,
    placeholderData: keepPreviousData,
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
    mutationFn: (body: schemas['BenefitCreate']) => {
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

export const useGrantsForBenefit = ({
  benefitId,
  organizationId,
  limit = 30,
  page = 1,
}: {
  benefitId: string
  organizationId: string
  limit?: number
  page?: number
}) =>
  useQuery({
    queryKey: [
      'benefits',
      'grants',
      benefitId,
      organizationId,
      { page, limit },
    ],
    queryFn: () => {
      return unwrap(
        api.GET('/v1/benefits/{id}/grants', {
          params: {
            path: { id: benefitId },
            query: {
              organization_id: organizationId,
              page,
              limit,
            },
          },
        }),
      )
    },
    retry: defaultRetry,
  })

export const useBenefitGrants = (
  organizationId?: string,
  parameters?: Omit<
    NonNullable<operations['benefit-grants:list']['parameters']['query']>,
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: ['benefit-grants', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/benefit-grants/', {
          params: {
            query: {
              organization_id: organizationId,
              ...parameters,
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
  })
