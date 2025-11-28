import { usePolarClient } from '@/providers/PolarClientProvider'
import { queryClient } from '@/utils/query'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'

export const useProduct = (
  organizationId: string | undefined,
  id: string | undefined,
) => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['product', organizationId, { id }],
    queryFn: () =>
      unwrap(
        polar.GET('/v1/products/{id}', { params: { path: { id: id ?? '' } } }),
      ),
    enabled: !!organizationId && !!id,
  })
}

export const useProducts = (
  organizationId: string | undefined,
  options: Omit<
    operations['products:list']['parameters']['query'],
    'organization_id'
  >,
) => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['products', organizationId, { ...options }],
    queryFn: () =>
      unwrap(
        polar.GET('/v1/products/', {
          params: { query: { organization_id: organizationId, ...options } },
        }),
      ),
  })
}

export const useInfiniteProducts = (
  organizationId: string | undefined,
  options?: Omit<
    operations['products:list']['parameters']['query'],
    'organization_id'
  >,
) => {
  const { polar } = usePolarClient()

  return useInfiniteQuery({
    queryKey: ['infinite', 'products', organizationId, { ...options }],
    queryFn: ({ pageParam = 1 }) =>
      unwrap(
        polar.GET('/v1/products/', {
          params: {
            query: {
              organization_id: organizationId,
              ...options,
              page: pageParam,
            },
          },
        }),
      ),
    enabled: !!organizationId,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.items.length === 0) return undefined
      return pages.length + 1
    },
  })
}

export const useProductUpdate = (
  organizationId: string | undefined,
  id: string,
) => {
  const { polar } = usePolarClient()

  return useMutation({
    mutationFn: (data: schemas['ProductUpdate']) =>
      unwrap(
        polar.PATCH('/v1/products/{id}', {
          params: { path: { id } },
          body: data,
        }),
      ),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['product', organizationId, { id }], data)

      queryClient.invalidateQueries({
        queryKey: ['products', organizationId],
      })

      queryClient.invalidateQueries({
        queryKey: ['infinite', 'products', organizationId],
      })
    },
  })
}
