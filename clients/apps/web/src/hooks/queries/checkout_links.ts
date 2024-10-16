import { useMutation, useQuery } from '@tanstack/react-query'

import { api, queryClient } from '@/utils/api'
import {
  CheckoutLinksApiCreateRequest,
  CheckoutLinksApiListRequest,
  CheckoutLinksApiUpdateRequest,
  ListResourceCheckoutLink,
  OrganizationIDFilter,
} from '@polar-sh/sdk'
import { defaultRetry } from './retry'

export const useCheckoutLinks = (
  organizationId: OrganizationIDFilter,
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
          queryKey: [
            'checkout_links',
            { productId: result.product_price.product_id },
          ],
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
          queryKey: [
            'checkout_links',
            { productId: result.product_price.product_id },
          ],
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
