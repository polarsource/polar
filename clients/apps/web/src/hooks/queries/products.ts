import { queryClient } from '@/utils/api'
import { BenefitPublicInner } from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export interface Product {
  id: string
  name: string
  description: string
  media?: string
  price: number
  benefits: BenefitPublicInner[]
  created_at: string
  updated_at: string
}

let products: Product[] = []

export const useProducts = (orgName?: string) =>
  useQuery({
    queryKey: ['products', 'organization', orgName],
    queryFn: () => {
      console.log('runnnnnn')
      return new Promise<{ items: Product[] }>((resolve) => {
        resolve({
          items: products,
        })
      })
    },
    retry: defaultRetry,
    enabled: !!orgName,
  })

export const useProduct = (id?: string) =>
  useQuery({
    queryKey: ['products', 'id', id],
    queryFn: () => {
      return new Promise<Product | undefined>((resolve) => {
        resolve(products.find((product) => product.id === id))
      })
    },
    retry: defaultRetry,
    enabled: !!id,
  })

export const useCreateProduct = (orgName?: string) =>
  useMutation({
    mutationFn: (
      productCreate: Omit<Product, 'id' | 'created_at' | 'updated_at'>,
    ) => {
      return new Promise((resolve) => {
        products = [
          ...products,
          {
            id: (Math.random() * 1000).toString(),
            ...productCreate,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]

        resolve(productCreate)
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['products', 'organization', orgName],
      })
    },
  })

export const useUpdateProduct = (orgName?: string) =>
  useMutation({
    mutationFn: ({
      id,
      productUpdate,
    }: {
      id: string
      productUpdate: Omit<Product, 'id' | 'created_at' | 'updated_at'>
    }) => {
      return new Promise((resolve) => {
        products = [
          ...products.filter((product) => product.id !== id),
          {
            id: (Math.random() * 1000).toString(),
            ...productUpdate,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]

        resolve(productUpdate)
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['products', 'organization', orgName],
      })

      queryClient.invalidateQueries({
        queryKey: ['products', 'id', _variables.id],
      })
    },
  })
