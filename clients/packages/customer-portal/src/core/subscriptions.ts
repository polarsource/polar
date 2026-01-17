import type { PortalClient } from './client'
import type {
  CustomerSubscription,
  CustomerSubscriptionCancel,
  CustomerSubscriptionUpdate,
  SubscriptionChargePreview,
} from './types'

export interface ListSubscriptionsParams {
  active?: boolean
  query?: string
  page?: number
  limit?: number
}

export function createSubscriptionMethods(portalClient: PortalClient) {
  return {
    getSubscriptions: async (
      params: ListSubscriptionsParams = {},
    ): Promise<CustomerSubscription[]> => {
      const result = await portalClient.request((client) =>
        client.GET('/v1/customer-portal/subscriptions/', {
          params: {
            query: {
              active: params.active,
              query: params.query,
              page: params.page,
              limit: params.limit,
            },
          },
        }),
      )
      return result.items
    },

    getSubscription: async (id: string): Promise<CustomerSubscription> => {
      return portalClient.request((client) =>
        client.GET('/v1/customer-portal/subscriptions/{id}', {
          params: { path: { id } },
        }),
      )
    },

    cancelSubscription: async (
      id: string,
      data: Omit<CustomerSubscriptionCancel, 'cancel_at_period_end'> = {},
    ): Promise<CustomerSubscription> => {
      return portalClient.request((client) =>
        client.PATCH('/v1/customer-portal/subscriptions/{id}', {
          params: { path: { id } },
          body: {
            cancel_at_period_end: true,
            ...data,
          },
        }),
      )
    },

    uncancelSubscription: async (id: string): Promise<CustomerSubscription> => {
      return portalClient.request((client) =>
        client.PATCH('/v1/customer-portal/subscriptions/{id}', {
          params: { path: { id } },
          body: {
            cancel_at_period_end: false,
            cancellation_reason: null,
            cancellation_comment: null,
          },
        }),
      )
    },

    updateSubscription: async (
      id: string,
      data: CustomerSubscriptionUpdate,
    ): Promise<CustomerSubscription> => {
      return portalClient.request((client) =>
        client.PATCH('/v1/customer-portal/subscriptions/{id}', {
          params: { path: { id } },
          body: data,
        }),
      )
    },

    getChargePreview: async (
      id: string,
    ): Promise<SubscriptionChargePreview> => {
      return portalClient.request((client) =>
        client.GET('/v1/customer-portal/subscriptions/{id}/charge-preview', {
          params: { path: { id } },
        }),
      )
    },
  }
}
