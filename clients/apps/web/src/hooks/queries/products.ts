import { api, queryClient } from '@/utils/api'
import {
  ProductBenefitsUpdate,
  ProductCreate,
  ProductUpdate,
  ProductsApiListProductsRequest,
} from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useProducts = (
  organizationId?: string,
  parameters?: Omit<
    ProductsApiListProductsRequest,
    'organization_id' | 'limit'
  >,
  limit = 100,
) =>
  useQuery({
    queryKey: ['products', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      api.products.listProducts({
        organizationId: organizationId ?? '',
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
      api.products.listProducts({
        organizationId: organizationId ?? '',
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
      return api.products.getProduct({
        id: id ?? '',
      })
    },
    retry: defaultRetry,
    enabled: !!id,
  })

export const useCreateProduct = (organizationId?: string) =>
  useMutation({
    mutationFn: (productCreate: ProductCreate) => {
      return api.products.createProduct({
        productCreate,
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
    mutationFn: ({
      id,
      productUpdate,
    }: {
      id: string
      productUpdate: ProductUpdate
    }) => {
      return api.products.updateProduct({
        id,
        productUpdate,
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
    mutationFn: ({
      id,
      productBenefitsUpdate,
    }: {
      id: string
      productBenefitsUpdate: ProductBenefitsUpdate
    }) => {
      return api.products.updateProductBenefits({
        id,
        productBenefitsUpdate,
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
