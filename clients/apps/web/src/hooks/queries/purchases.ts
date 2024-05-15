import { queryClient } from '@/utils/api'
import { Product } from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Product as DummyProduct, products } from './dummy_products'
import { defaultRetry } from './retry'

export interface Purchase {
  id: string
  product: Product | DummyProduct
  created_at: string
  updated_at: string
}

export let purchases: Purchase[] = [
  {
    id: '1',
    product: products[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    product: products[1],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    product: products[2],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export const usePurchases = () =>
  useQuery({
    queryKey: ['purchases'],
    queryFn: () => {
      return new Promise<{ items: Purchase[] }>((resolve) => {
        resolve({
          items: purchases,
        })
      })
    },
    retry: defaultRetry,
  })

export const usePurchase = (id?: string) =>
  useQuery({
    queryKey: ['purchases', 'id', id],
    queryFn: () => {
      return new Promise<Purchase | undefined>((resolve) => {
        resolve(purchases.find((purchase) => purchase.id === id))
      })
    },
    retry: defaultRetry,
    enabled: !!id,
  })

export const useCreatePurchase = () =>
  useMutation({
    mutationFn: (
      purchaseCreate: Omit<Purchase, 'id' | 'created_at' | 'updated_at'>,
    ) => {
      return new Promise((resolve) => {
        purchases = [
          ...purchases,
          {
            id: (Math.random() * 1000).toString(),
            ...purchaseCreate,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]

        resolve(purchaseCreate)
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['products'],
      })
    },
  })
