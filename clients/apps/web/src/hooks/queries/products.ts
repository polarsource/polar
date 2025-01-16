import revalidate from '@/app/actions'
import { api, queryClient } from '@/utils/api'
import {
  Organization,
  OrganizationIDFilter1,
  Product,
  ProductBenefitsUpdate,
  ProductCreate,
  ProductUpdate,
  ProductsApiListRequest,
} from '@polar-sh/api'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useProducts = (
  organizationId: OrganizationIDFilter1,
  parameters?: Omit<ProductsApiListRequest, 'organizationId'>,
) =>
  useQuery({
    queryKey: ['products', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      api.products.list({
        organizationId,
        isArchived: false,
        ...(parameters || {}),
      }),
    retry: defaultRetry,
  })

export const useSelectedProducts = (id: string[]) =>
  useQuery({
    queryKey: ['products', { id }],
    queryFn: async () => {
      const products: Product[] = []
      let page = 1
      while (true) {
        const data = await api.products.list({
          id,
          isArchived: false,
          page,
          limit: 1,
        })
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
      api.products.list({
        organizationId: organizationId ?? '',
        benefitId: benefitId ?? '',
        isArchived: false,
        limit,
      }),
    retry: defaultRetry,
    enabled: !!organizationId && !!benefitId,
  })

export const useProduct = (id?: string) =>
  useQuery({
    queryKey: ['products', { id }],
    queryFn: () => {
      return api.products.get({
        id: id ?? '',
      })
    },
    retry: defaultRetry,
    enabled: !!id,
  })

export const useCreateProduct = (organization: Organization) =>
  useMutation({
    mutationFn: (body: ProductCreate) => {
      return api.products.create({
        body,
      })
    },
    onSuccess: async (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['products', { organizationId: organization.id }],
      })
      await revalidate(`storefront:${organization.slug}`)
    },
  })

export const useUpdateProduct = (organization: Organization) =>
  useMutation({
    mutationFn: ({ id, body }: { id: string; body: ProductUpdate }) => {
      return api.products.update({
        id,
        body,
      })
    },
    onSuccess: async (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['products', { organizationId: organization.id }],
      })

      queryClient.invalidateQueries({
        queryKey: ['products', { id: _variables.id }],
      })

      await revalidate(`storefront:${organization.slug}`)
    },
  })

export const useUpdateProductBenefits = (organization: Organization) =>
  useMutation({
    mutationFn: ({ id, body }: { id: string; body: ProductBenefitsUpdate }) => {
      return api.products.updateBenefits({
        id,
        body,
      })
    },
    onSuccess: async (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['products', { organizationId: organization.id }],
      })

      queryClient.invalidateQueries({
        queryKey: ['products', { id: _variables.id }],
      })

      await revalidate(`storefront:${organization.slug}`)
    },
  })
