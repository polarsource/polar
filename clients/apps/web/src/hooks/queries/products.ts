import { api, queryClient } from '@/utils/api'
import {
  ProductBenefitsUpdate,
  ProductCreate,
  ProductUpdate,
  ProductsApiListRequest,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useProducts = (
  organizationId?: string,
  parameters?: Omit<ProductsApiListRequest, 'organization_id' | 'limit'>,
  limit = 100,
) =>
  useQuery({
    queryKey: ['products', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      api.products.list({
        organizationId: organizationId ? [organizationId] : [],
        limit,
        ...(parameters || {}),
      }),
    retry: defaultRetry,
    enabled: !!organizationId,
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
        organizationId: organizationId ? [organizationId] : [],
        benefitId: benefitId ?? '',
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

export const useFreeTier = (organizationId?: string) =>
  useQuery({
    queryKey: ['products', 'freeTier', { organizationId }],
    queryFn: () =>
      api.products
        .list({
          organizationId: organizationId ? [organizationId] : [],
          type: SubscriptionTierType.FREE,
        })
        .then((res) => res.items?.[0]),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useCreateProduct = (organizationId?: string) =>
  useMutation({
    mutationFn: (body: ProductCreate) => {
      return api.products.create({
        body,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['products', { organizationId }],
      })
    },
  })

export const useUpdateProduct = (organizationId?: string) =>
  useMutation({
    mutationFn: ({ id, body }: { id: string; body: ProductUpdate }) => {
      return api.products.update({
        id,
        body,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['products', { organizationId }],
      })

      queryClient.invalidateQueries({
        queryKey: ['products', { id: _variables.id }],
      })
    },
  })

export const useUpdateProductBenefits = (organizationId?: string) =>
  useMutation({
    mutationFn: ({ id, body }: { id: string; body: ProductBenefitsUpdate }) => {
      return api.products.updateBenefits({
        id,
        body,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['products', { organizationId }],
      })

      queryClient.invalidateQueries({
        queryKey: ['products', { id: _variables.id }],
      })
    },
  })
