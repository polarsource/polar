import { useMutation, useQuery } from '@tanstack/react-query'

import { api, queryClient } from '@/utils/api'
import {
  CheckoutLink,
  CheckoutLinksApiCreateRequest,
  CheckoutLinksApiListRequest,
  CheckoutLinksApiUpdateRequest,
  ListResourceCheckoutLink,
  OrganizationIDFilter1,
} from '@polar-sh/sdk'
import { defaultRetry } from './retry'

export const useCheckoutLinks = (
  organizationId: OrganizationIDFilter1,
  parameters?: Omit<CheckoutLinksApiListRequest, 'organizationId'>,
) =>
  useQuery({
    queryKey: ['checkout_links', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      api.checkoutLinks.list({
        organizationId,
        ...(parameters || {}),
      }),
    retry: defaultRetry,
  })

export const useCreateCheckoutLink = () =>
  useMutation({
    mutationFn: (body: CheckoutLinksApiCreateRequest) => {
      return api.checkoutLinks.create(body)
    },
    onSuccess: (result, _variables, _ctx) => {
      queryClient.setQueriesData<ListResourceCheckoutLink>(
        {
          queryKey: ['checkout_links', { productId: result.product.id }],
        },
        (old) => {
          if (!old) {
            return {
              items: [result],
              pagination: {
                total_count: 1,
                max_page: 1,
              },
            }
          } else {
            return {
              items: [...old.items, result],
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
    mutationFn: (body: CheckoutLinksApiUpdateRequest) => {
      return api.checkoutLinks.update(body)
    },
    onSuccess: (result, _variables, _ctx) => {
      queryClient.setQueriesData<ListResourceCheckoutLink>(
        {
          queryKey: ['checkout_links', { productId: result.product.id }],
        },
        (old) => {
          if (!old) {
            return {
              items: [result],
              pagination: {
                total_count: 1,
                max_page: 1,
              },
            }
          } else {
            return {
              items: old.items.map((item) =>
                item.id === result.id ? result : item,
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
    mutationFn: (checkoutLink: CheckoutLink) => {
      return api.checkoutLinks.delete({
        id: checkoutLink.id,
      })
    },
    onSuccess: (_result, variables, _ctx) => {
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
