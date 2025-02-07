import { queryClient } from '@/utils/api'
import { api } from '@/utils/client'
import { components, operations, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useListSubscriptions = (
  organizationId?: string,
  parameters?: Omit<
    operations['subscriptions:list']['parameters']['query'],
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: ['subscriptions', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/subscriptions/', {
          params: {
            query: {
              organization_id: organizationId,
              ...parameters,
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useSubscription = (
  id: string,
  initialData?: components['schemas']['Subscription'],
) =>
  useQuery({
    queryKey: ['subscriptions', { id }],
    queryFn: () =>
      unwrap(api.GET('/v1/subscriptions/{id}', { params: { path: { id } } })),
    retry: defaultRetry,
    initialData,
  })

export const useUpdateSubscription = (id: string) =>
  useMutation({
    mutationFn: (body: components['schemas']['SubscriptionUpdate']) => {
      return api.PATCH('/v1/subscriptions/{id}', {
        params: { path: { id } },
        body,
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      const { data, error } = result
      if (error) {
        return
      }
      queryClient.setQueriesData(
        {
          queryKey: ['subscriptions', { id }],
        },
        result,
      )
      queryClient.setQueriesData<
        components['schemas']['ListResource_Subscription_']
      >(
        {
          queryKey: [
            'subscriptions',
            { organizationId: data.product.organization_id },
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
