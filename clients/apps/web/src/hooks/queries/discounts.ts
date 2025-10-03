import { queryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { defaultRetry } from './retry'

const invalidateDiscountsQueries = ({
  id,
  organizationId,
}: {
  id?: string
  organizationId?: string
}) => {
  if (id) {
    queryClient.invalidateQueries({
      queryKey: ['discounts', 'id', id],
    })
  }

  if (organizationId) {
    queryClient.invalidateQueries({
      queryKey: ['discounts', { organizationId }],
    })
  }
}

export const useDiscounts = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['discounts:list']['parameters']['query']>,
    'organization_id'
  >,
) =>
  useInfiniteQuery({
    initialPageParam: 1,
    getNextPageParam: (lastPage: schemas['ListResource_Discount_'], _, lastPageParam) => {
      if (lastPage.pagination.max_page === lastPageParam) {
        return null;
      }
      return lastPageParam + 1
    },
    queryKey: ['discounts', { organizationId, ...(parameters || {}) }],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/discounts/', {
          params: {
            query: { organization_id: organizationId, ...(parameters || {}), page: pageParam },
          },
        }),
      ),
    retry: defaultRetry,
  })

export const useCreateDiscount = (organizationId: string) =>
  useMutation({
    mutationFn: (body: schemas['DiscountCreate']) => {
      return api.POST('/v1/discounts/', {
        body,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      const { data, error } = result
      if (error) {
        return
      }
      invalidateDiscountsQueries({ organizationId, id: data.id })
    },
  })

export const useUpdateDiscount = (id: string) =>
  useMutation({
    mutationFn: (body: schemas['DiscountUpdate']) => {
      return api.PATCH('/v1/discounts/{id}', {
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
      invalidateDiscountsQueries({
        id,
        organizationId: data.organization_id,
      })
    },
  })

export const useDeleteDiscount = () =>
  useMutation({
    mutationFn: (discount: schemas['Discount']) => {
      return api.DELETE('/v1/discounts/{id}', {
        params: {
          path: {
            id: discount.id,
          },
        },
      })
    },
    onSuccess: (result, variables, _ctx) => {
      if (result.error) {
        return
      }
      invalidateDiscountsQueries({
        organizationId: variables.organization_id,
      })
    },
  })
