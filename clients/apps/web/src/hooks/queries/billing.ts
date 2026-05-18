import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export type OrganizationPaymentMethodCard =
  schemas['OrganizationPaymentMethodCard']
export type OrganizationPaymentMethod =
  | OrganizationPaymentMethodCard
  | schemas['OrganizationPaymentMethodGeneric']

// Placeholder types — replace with generated schemas once the add/confirm
// endpoints exist on the backend.
export type OrganizationPaymentMethodCreate = {
  confirmation_token_id: string
  set_default: boolean
  return_url: string
}

export type OrganizationPaymentMethodConfirm = {
  setup_intent_id: string
  set_default: boolean
}

export type OrganizationPaymentMethodAddResult = {
  status: 'succeeded' | 'requires_action'
  client_secret: string
}

export const useOrganizationOrders = (organizationId: string) =>
  useQuery({
    queryKey: ['organization-billing', organizationId, 'orders'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/orders', {
          params: {
            path: { id: organizationId },
            query: { page: 1, limit: 50 },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useGetOrganizationOrderInvoice = (organizationId: string) =>
  useMutation({
    mutationFn: (orderId: string) =>
      unwrap(
        api.GET('/v1/organizations/{id}/orders/{order_id}/invoice', {
          params: {
            path: { id: organizationId, order_id: orderId },
          },
        }),
      ),
  })

export const useOrganizationPlans = (organizationId: string) =>
  useQuery({
    queryKey: ['organization-billing', organizationId, 'plans'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/plans', {
          params: { path: { id: organizationId } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useOrganizationSubscription = (organizationId: string) =>
  useQuery({
    queryKey: ['organization-billing', organizationId, 'subscription'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/subscription', {
          params: { path: { id: organizationId } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useStartSubscriptionCheckout = (organizationId: string) =>
  useMutation({
    mutationFn: (body: schemas['OrganizationCheckoutRequest']) =>
      api.POST('/v1/organizations/{id}/subscription', {
        params: { path: { id: organizationId } },
        body,
      }),
  })

export const useChangeSubscriptionPlan = (organizationId: string) =>
  useMutation({
    mutationFn: (body: schemas['OrganizationSubscriptionUpdate']) =>
      api.PATCH('/v1/organizations/{id}/subscription', {
        params: { path: { id: organizationId } },
        body,
      }),
    onSuccess: (result) => {
      if (result.error) return
      getQueryClient().invalidateQueries({
        queryKey: ['organization-billing', organizationId, 'subscription'],
      })
    },
  })

export const useOrganizationPaymentMethods = (organizationId: string) =>
  useQuery({
    queryKey: ['organization-billing', organizationId, 'payment-methods'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/payment-methods', {
          params: { path: { id: organizationId } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

// TODO: POST `/v1/organizations/{id}/payment-methods`
export const useAddOrganizationPaymentMethod = (organizationId: string) =>
  useMutation({
    mutationFn: async (
      body: OrganizationPaymentMethodCreate,
    ): Promise<{
      data?: OrganizationPaymentMethodAddResult
      error?: { detail?: string }
    }> => {
      void body
      return {
        error: {
          detail: 'Organization payment methods are not yet supported.',
        },
      }
    },
    onSuccess: (result) => {
      if (result.error) return
      getQueryClient().invalidateQueries({
        queryKey: ['organization-billing', organizationId, 'payment-methods'],
      })
    },
  })

// TODO: POST `/v1/organizations/{id}/payment-methods/confirm`
export const useConfirmOrganizationPaymentMethod = (organizationId: string) =>
  useMutation({
    mutationFn: async (
      body: OrganizationPaymentMethodConfirm,
    ): Promise<{ error?: { detail?: string } }> => {
      void body
      return {
        error: {
          detail: 'Organization payment methods are not yet supported.',
        },
      }
    },
    onSuccess: (result) => {
      if (result.error) return
      getQueryClient().invalidateQueries({
        queryKey: ['organization-billing', organizationId, 'payment-methods'],
      })
    },
  })

export const useDeleteOrganizationPaymentMethod = (organizationId: string) =>
  useMutation({
    mutationFn: (paymentMethodId: string) =>
      unwrap(
        api.DELETE(
          '/v1/organizations/{id}/payment-methods/{payment_method_id}',
          {
            params: {
              path: { id: organizationId, payment_method_id: paymentMethodId },
            },
          },
        ),
      ),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['organization-billing', organizationId, 'payment-methods'],
      })
    },
  })

export type OrganizationBillingDetails = schemas['OrganizationBillingDetails']
export type OrganizationBillingDetailsUpdate =
  schemas['OrganizationBillingDetailsUpdate']

export const useOrganizationBillingDetails = (organizationId: string) =>
  useQuery({
    queryKey: ['organization-billing', organizationId, 'billing-details'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/billing-details', {
          params: { path: { id: organizationId } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useUpdateOrganizationBillingDetails = (organizationId: string) =>
  useMutation({
    mutationFn: (body: schemas['OrganizationBillingDetailsUpdate']) =>
      unwrap(
        api.PATCH('/v1/organizations/{id}/billing-details', {
          params: { path: { id: organizationId } },
          body,
        }),
      ),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['organization-billing', organizationId, 'billing-details'],
      })
    },
  })
