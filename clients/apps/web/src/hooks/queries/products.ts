import { api, queryClient } from '@/utils/api'
import {
  ProductBenefitsUpdate,
  ProductCreate,
  ProductUpdate,
} from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useProducts = (orgId?: string, limit = 100) =>
  useQuery({
    queryKey: ['products', 'organization', orgId],
    queryFn: () =>
      api.products.listProducts({
        organizationId: orgId ?? '',
        limit,
      }),
    retry: defaultRetry,
    enabled: !!orgId,
  })

export const useProduct = (id?: string) =>
  useQuery({
    queryKey: ['products', 'id', id],
    queryFn: () => {
      return api.products.getProduct({
        id: id ?? '',
      })
    },
    retry: defaultRetry,
    enabled: !!id,
  })

export const useCreateProduct = (orgId?: string) =>
  useMutation({
    mutationFn: (productCreate: ProductCreate) => {
      return api.products.createProduct({
        productCreate,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['products', 'organization', orgId],
      })
    },
  })

export const useUpdateProduct = (orgId?: string) =>
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
        queryKey: ['products', 'organization', orgId],
      })

      queryClient.invalidateQueries({
        queryKey: ['products', 'id', _variables.id],
      })
    },
  })

export const useUpdateProductBenefits = (orgId?: string) =>
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
        queryKey: ['products', 'organization', orgId],
      })

      queryClient.invalidateQueries({
        queryKey: ['products', 'id', _variables.id],
      })
    },
  })
