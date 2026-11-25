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

    queryClient.invalidateQueries({
      queryKey: ['benefits', 'files', id],
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
              ...(parameters?.id ? {} : { catalog_status: 'live' as const }),
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
              ...(parameters?.id ? {} : { catalog_status: 'live' as const }),
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

export const useBenefitFiles = (
  id: string,
  parameters: NonNullable<operations['benefits:files']['parameters']['query']>,
  enabled: boolean = true,
) =>
  useQuery({
    queryKey: ['benefits', 'files', id, parameters],
    queryFn: () =>
      unwrap(
        api.GET('/v1/benefits/{id}/files', {
          params: {
            path: { id },
            query: parameters,
          },
        }),
      ),
    retry: defaultRetry,
    enabled: enabled && !!id,
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
    onSuccess: (result) => {
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
    onSuccess: (result) => {
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
    onSuccess: (result, variables) => {
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
  isGranted,
}: {
  benefitId: string
  organizationId: string
  limit?: number
  page?: number
  isGranted?: boolean
}) =>
  useQuery({
    queryKey: [
      'benefits',
      'grants',
      benefitId,
      organizationId,
      { page, limit, isGranted },
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
              ...(isGranted !== undefined ? { is_granted: isGranted } : {}),
            },
          },
        }),
      )
    },
    retry: defaultRetry,
  })

const BENEFIT_GRANTS_PAGE_SIZE = 100

const isManualGrantInProgress = (grant: schemas['BenefitGrant']) =>
  grant.manually_granted_at &&
  !grant.manually_revoked_at &&
  !grant.is_granted &&
  !grant.is_revoked &&
  !grant.error

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
    refetchInterval: ({ state }) =>
      state.data?.items.some(isManualGrantInProgress) ? 2000 : false,
  })

// Every page of the matching grants, for when one page cannot be trusted to
// hold the ones that are wanted.
export const useAllBenefitGrants = (
  organizationId: string,
  parameters: Omit<
    NonNullable<operations['benefit-grants:list']['parameters']['query']>,
    'organization_id' | 'page' | 'limit'
  >,
) =>
  useQuery({
    queryKey: ['benefit-grants', 'all', { organizationId, ...parameters }],
    queryFn: async () => {
      const grants: schemas['BenefitGrant'][] = []
      for (let page = 1; ; page++) {
        const { items, pagination } = await unwrap(
          api.GET('/v1/benefit-grants/', {
            params: {
              query: {
                organization_id: organizationId,
                ...parameters,
                limit: BENEFIT_GRANTS_PAGE_SIZE,
                page,
              },
            },
          }),
        )
        grants.push(...items)
        if (items.length === 0 || page >= pagination.max_page) return grants
      }
    },
    retry: defaultRetry,
    refetchInterval: ({ state }) =>
      state.data?.some(isManualGrantInProgress) ? 2000 : false,
  })

const invalidateBenefitGrantQueries = async (benefitId: string) => {
  const queryClient = getQueryClient()
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['benefit-grants'] }),
    queryClient.invalidateQueries({
      queryKey: ['benefits', 'grants', benefitId],
    }),
  ])
}

export const useCreateBenefitGrant = () =>
  useMutation({
    mutationFn: (body: schemas['BenefitGrantCreate']) =>
      api.POST('/v1/benefit-grants/', { body }),
    onSuccess: ({ data }) =>
      data && invalidateBenefitGrantQueries(data.benefit_id),
  })

export const useRevokeBenefitGrant = () =>
  useMutation({
    mutationFn: (id: string) =>
      api.DELETE('/v1/benefit-grants/{id}', { params: { path: { id } } }),
    onSuccess: ({ data }) =>
      data && invalidateBenefitGrantQueries(data.benefit_id),
  })

export const useUnrevokeBenefitGrant = () =>
  useMutation({
    mutationFn: (id: string) =>
      api.PATCH('/v1/benefit-grants/{id}', {
        params: { path: { id } },
        body: { manually_revoked_at: null },
      }),
    onSuccess: ({ data }) =>
      data && invalidateBenefitGrantQueries(data.benefit_id),
  })
