import { queryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useCheckoutLinks = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['checkout-links:list']['parameters']['query']>,
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: ['checkout_links', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/checkout-links/', {
          params: {
            query: {
              organization_id: organizationId,
              ...(parameters || {}),
            },
          },
        }),
      ),
    retry: defaultRetry,
  })

export const useCreateCheckoutLink = () =>
  useMutation({
    mutationFn: (body: schemas['CheckoutLinkCreate']) => {
      return api.POST('/v1/checkout-links/', { body })
    },
    onSuccess: (result, _variables, _ctx) => {
      const { data, error } = result
      if (error) {
        return
      }
      queryClient.setQueriesData<schemas['ListResource_CheckoutLink_']>(
        {
          queryKey: [
            'checkout_links',
            {
              product_id: data.product.id,
            },
          ],
        },
        (old) => {
          if (!old) {
            return {
              items: [data],
              pagination: {
                total_count: 1,
                max_page: 1,
              },
            }
          } else {
            return {
              items: [...old.items, data],
              pagination: {
                total_count: old.pagination.total_count + 1,
                max_page: old.pagination.max_page,
              },
            }
          }
        },
      )
    },
  })

export const useUpdateCheckoutLink = () =>
  useMutation({
    mutationFn: (variables: {
      id: string
      body: schemas['CheckoutLinkUpdate']
    }) => {
      return api.PATCH('/v1/checkout-links/{id}', {
        params: {
          path: {
            id: variables.id,
          },
        },
        body: variables.body,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      const { data, error } = result
      if (error) {
        return
      }
      queryClient.setQueriesData<schemas['ListResource_CheckoutLink_']>(
        {
          queryKey: ['checkout_links', { product_id: data.product.id }],
        },
        (old) => {
          if (!old) {
            return {
              items: [data],
              pagination: {
                total_count: 1,
                max_page: 1,
              },
            }
          } else {
            return {
              items: old.items.map((item) =>
                item.id === data.id ? data : item,
              ),
              pagination: old.pagination,
            }
          }
        },
      )
    },
  })

export const useDeleteCheckoutLink = () =>
  useMutation({
    mutationFn: (checkoutLink: schemas['CheckoutLink']) => {
      return api.DELETE('/v1/checkout-links/{id}', {
        params: {
          path: {
            id: checkoutLink.id,
          },
        },
      })
    },
    onSuccess: (result, variables, _ctx) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: [
          'checkout_links',
          {
            productId: variables.product.id,
          },
        ],
      })
    },
  })
