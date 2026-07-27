import { extractApiErrorMessage } from '@/utils/api/errors'
import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useSubscriptions = (
  organizationId?: string,
  parameters?: Omit<
    NonNullable<operations['subscriptions:list']['parameters']['query']>,
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
  initialData?: schemas['Subscription'],
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: ['subscriptions', { id }],
    queryFn: () =>
      unwrap(api.GET('/v1/subscriptions/{id}', { params: { path: { id } } })),
    retry: defaultRetry,
    initialData,
    enabled: options?.enabled ?? true,
  })

export const useSubscriptionChargePreview = (
  id: string,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: ['subscriptions', { id }, 'charge-preview'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/subscriptions/{id}/charge-preview', {
          params: { path: { id } },
        }),
      ),
    retry: defaultRetry,
    enabled: options?.enabled ?? true,
  })

export const useSubscriptionCancelPreview = (
  id: string,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: ['subscriptions', { id }, 'cancel-preview'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/subscriptions/{id}/cancel-preview', {
          params: { path: { id } },
        }),
      ),
    retry: defaultRetry,
    enabled: options?.enabled ?? true,
  })

export const useUpdateSubscription = (id: string) =>
  useMutation({
    mutationFn: (body: schemas['SubscriptionUpdate']) => {
      return api.PATCH('/v1/subscriptions/{id}', {
        params: { path: { id } },
        body,
      })
    },
    onSuccess: (result) => {
      const { data, error } = result
      if (error) {
        return
      }
      const queryClient = getQueryClient()
      queryClient.setQueriesData<schemas['Subscription']>(
        {
          queryKey: ['subscriptions', { id }],
          exact: true,
        },
        data,
      )
      queryClient.setQueriesData<schemas['ListResource_Subscription_']>(
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

      queryClient.invalidateQueries({
        queryKey: ['subscriptions', { id }, 'charge-preview'],
      })
      queryClient.invalidateQueries({
        queryKey: ['subscriptions', { id }, 'cancel-preview'],
      })
    },
  })

export const useUncancelSubscription = (id: string) =>
  useMutation({
    mutationFn: async () => {
      const result = await api.PATCH('/v1/subscriptions/{id}', {
        params: { path: { id } },
        body: {
          cancel_at_period_end: false,
        },
      })
      if (result.error) {
        throw new Error(
          extractApiErrorMessage(
            result.error,
            'Failed to uncancel subscription',
          ),
        )
      }
      return result
    },
    onSuccess: (result) => {
      const { data, error } = result
      if (error) {
        return
      }
      const queryClient = getQueryClient()
      queryClient.setQueriesData<schemas['Subscription']>(
        {
          queryKey: ['subscriptions', { id }],
          exact: true,
        },
        data,
      )
      queryClient.setQueriesData<schemas['ListResource_Subscription_']>(
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

      queryClient.invalidateQueries({
        queryKey: ['subscriptions', { id }, 'charge-preview'],
      })
      queryClient.invalidateQueries({
        queryKey: ['subscriptions', { id }, 'cancel-preview'],
      })
    },
  })

const applySubscriptionUpdateToCache = (
  id: string,
  data: schemas['Subscription'],
) => {
  const queryClient = getQueryClient()
  queryClient.setQueriesData<schemas['Subscription']>(
    {
      queryKey: ['subscriptions', { id }],
      exact: true,
    },
    data,
  )
  queryClient.setQueriesData<schemas['ListResource_Subscription_']>(
    {
      queryKey: [
        'subscriptions',
        { organizationId: data.product.organization_id },
      ],
    },
    (old) =>
      old
        ? {
            items: old.items.map((item) => (item.id === data.id ? data : item)),
            pagination: old.pagination,
          }
        : {
            items: [data],
            pagination: {
              total_count: 1,
              max_page: 1,
            },
          },
  )
  queryClient.invalidateQueries({
    queryKey: ['subscriptions', { id }, 'charge-preview'],
  })
  queryClient.invalidateQueries({
    queryKey: ['subscriptions', { id }, 'cancel-preview'],
  })
  queryClient.invalidateQueries({
    queryKey: [
      'subscriptions',
      { organizationId: data.product.organization_id },
    ],
  })
}

export const usePauseSubscription = (id: string) =>
  useMutation({
    mutationFn: async (body: { resumes_at?: string | null }) => {
      const result = await api.PATCH('/v1/subscriptions/{id}', {
        params: { path: { id } },
        body: {
          pause_at_period_end: true,
          resumes_at: body.resumes_at ?? null,
        },
      })
      if (result.error) {
        throw new Error(
          extractApiErrorMessage(result.error, 'Failed to pause subscription'),
        )
      }
      return result
    },
    onSuccess: (result) => {
      const { data, error } = result
      if (error) {
        return
      }
      applySubscriptionUpdateToCache(id, data)
    },
  })

export const useCancelScheduledPause = (id: string) =>
  useMutation({
    mutationFn: async () => {
      const result = await api.PATCH('/v1/subscriptions/{id}', {
        params: { path: { id } },
        body: {
          pause_at_period_end: false,
        },
      })
      if (result.error) {
        throw new Error(
          extractApiErrorMessage(
            result.error,
            'Failed to cancel the scheduled pause',
          ),
        )
      }
      return result
    },
    onSuccess: (result) => {
      const { data, error } = result
      if (error) {
        return
      }
      applySubscriptionUpdateToCache(id, data)
    },
  })

export const useResumeSubscription = (id: string) =>
  useMutation({
    mutationFn: async () => {
      const result = await api.PATCH('/v1/subscriptions/{id}', {
        params: { path: { id } },
        body: {
          resume: true,
        },
      })
      if (result.error) {
        throw new Error(
          extractApiErrorMessage(result.error, 'Failed to resume subscription'),
        )
      }
      return result
    },
    onSuccess: (result) => {
      const { data, error } = result
      if (error) {
        return
      }
      applySubscriptionUpdateToCache(id, data)
    },
  })

export const useClearPendingSubscriptionUpdate = (id: string) =>
  useMutation({
    mutationFn: () => {
      return api.PATCH('/v1/subscriptions/{id}', {
        params: { path: { id } },
        body: {
          pending_update: null,
        } as schemas['SubscriptionUpdateClear'],
      })
    },
    onSuccess: (result) => {
      const { data, error } = result
      if (error) {
        return
      }
      const queryClient = getQueryClient()
      queryClient.setQueriesData<schemas['Subscription']>(
        {
          queryKey: ['subscriptions', { id }],
          exact: true,
        },
        data,
      )
      queryClient.setQueriesData<schemas['ListResource_Subscription_']>(
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

      queryClient.invalidateQueries({
        queryKey: ['subscriptions', { id }, 'charge-preview'],
      })
      queryClient.invalidateQueries({
        queryKey: ['subscriptions', { id }, 'cancel-preview'],
      })
    },
  })
