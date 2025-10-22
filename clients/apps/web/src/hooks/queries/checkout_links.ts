import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useCheckoutLinks = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['checkout-links:list']['parameters']['query']>,
    'organization_id'
  >,
) =>
  useInfiniteQuery({
    queryKey: ['checkout_links', { organizationId, ...(parameters || {}) }],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/checkout-links/', {
          params: {
            query: {
              organization_id: organizationId,
              ...(parameters || {}),
              page: pageParam,
            },
          },
        }),
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (
        lastPageParam === lastPage.pagination.max_page ||
        lastPage.items.length === 0
      ) {
        return null
      }

      return lastPageParam + 1
    },
    retry: defaultRetry,
  })

export const useCheckoutLink = (id?: string | null) =>
  useQuery({
    queryKey: ['checkout_link', id],
    queryFn: () =>
      unwrap(
        api.GET('/v1/checkout-links/{id}', {
          params: { path: { id: id! } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!id,
  })

export const useCreateCheckoutLink = () =>
  useMutation({
    mutationFn: (body: schemas['CheckoutLinkCreateProducts']) => {
      return api.POST('/v1/checkout-links/', { body })
    },
    onSuccess: (result, _variables, _ctx) => {
      const { data, error } = result

      if (error) {
        return
      }

      getQueryClient().invalidateQueries({
        queryKey: ['checkout_links', { organizationId: data.organization_id }],
      })
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
    onSuccess: (result, variables, _ctx) => {
      if (result.error) {
        return
      }

      const queryClient = getQueryClient()
      queryClient.setQueriesData<{
        pages: schemas['ListResource_CheckoutLink_'][]
        pageParams: unknown[]
      }>(
        {
          queryKey: [
            'checkout_links',
            { organizationId: result.data.organization_id },
          ],
        },
        (old) => {
          if (!old) {
            return {
              pages: [],
              pageParams: [],
            }
          }

          return {
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === variables.id ? result.data : item,
              ),
            })),
            pageParams: old.pageParams,
          }
        },
      )

      queryClient.setQueryData<schemas['CheckoutLink']>(
        ['checkout_link', variables.id],
        result.data,
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

      const queryClient = getQueryClient()
      queryClient.setQueriesData<{
        pages: schemas['ListResource_CheckoutLink_'][]
        pageParams: unknown[]
      }>(
        {
          queryKey: [
            'checkout_links',
            { organizationId: variables.organization_id },
          ],
        },
        (old) => {
          if (!old) {
            return {
              pages: [],
              pageParams: [],
            }
          }

          return {
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.id !== variables.id),
            })),
            pageParams: old.pageParams,
          }
        },
      )

      queryClient.invalidateQueries({
        queryKey: ['checkout_link', variables.id],
      })
    },
  })
