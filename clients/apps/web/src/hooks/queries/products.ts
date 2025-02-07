import revalidate from '@/app/actions'
import { queryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { components, operations, unwrap } from '@polar-sh/client'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useProducts = (
  organizationId: string | string[],
  parameters?: Omit<
    operations['products:list']['parameters']['query'],
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: ['products', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/products/', {
          params: {
            query: {
              organization_id: organizationId,
              is_archived: false,
              ...(parameters || {}),
            },
          },
        }),
      ),
    retry: defaultRetry,
  })

export const useSelectedProducts = (id: string[]) =>
  useQuery({
    queryKey: ['products', { id }],
    queryFn: async () => {
      const products: components['schemas']['Product'][] = []
      let page = 1
      while (true) {
        const data = await unwrap(
          api.GET('/v1/products/', {
            params: {
              query: {
                id,
                is_archived: false,
                page,
                limit: 1,
              },
            },
          }),
        )
        products.push(...data.items)
        if (data.pagination.max_page === page) {
          break
        }
        page++
      }
      return products
    },
    placeholderData: keepPreviousData,
    retry: defaultRetry,
    enabled: id.length > 0,
  })

export const useBenefitProducts = (
  organizationId?: string,
  benefitId?: string,
  limit = 100,
) =>
  useQuery({
    queryKey: ['products', { organizationId, benefitId }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/products/', {
          params: {
            query: {
              organization_id: organizationId ?? '',
              benefit_id: benefitId ?? '',
              is_archived: false,
              limit,
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId && !!benefitId,
  })

export const useProduct = (id?: string) =>
  useQuery({
    queryKey: ['products', { id }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/products/{id}', { params: { path: { id: id ?? '' } } }),
      ),
    retry: defaultRetry,
    enabled: !!id,
  })

export const useCreateProduct = (
  organization: components['schemas']['Organization'],
) =>
  useMutation({
    mutationFn: (body: components['schemas']['ProductCreate']) => {
      return api.POST('/v1/products/', { body })
    },
    onSuccess: async (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['products', { organizationId: organization.id }],
      })
      await revalidate(`storefront:${organization.slug}`)
    },
  })

export const useUpdateProduct = (
  organization: components['schemas']['Organization'],
) =>
  useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: components['schemas']['ProductUpdate']
    }) => {
      return api.PATCH('/v1/products/{id}', {
        params: { path: { id } },
        body,
      })
    },
    onSuccess: async (result, variables, _ctx) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['products', { organizationId: organization.id }],
      })
      queryClient.invalidateQueries({
        queryKey: ['products', { id: variables.id }],
      })
      await revalidate(`storefront:${organization.slug}`)
    },
  })

export const useUpdateProductBenefits = (
  organization: components['schemas']['Organization'],
) =>
  useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: components['schemas']['ProductBenefitsUpdate']
    }) => {
      return api.POST('/v1/products/{id}/benefits', {
        params: { path: { id } },
        body,
      })
    },
    onSuccess: async (result, variables, _ctx) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['products', { organizationId: organization.id }],
      })

      queryClient.invalidateQueries({
        queryKey: ['products', { id: variables.id }],
      })

      await revalidate(`storefront:${organization.slug}`)
    },
  })
