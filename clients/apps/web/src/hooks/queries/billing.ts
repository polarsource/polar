import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

// Placeholder types — replace with generated `schemas['OrganizationPaymentMethod*']`
// once the backend endpoints exist.
export type OrganizationPaymentMethodCard = {
  id: string
  type: 'card'
  default: boolean
  method_metadata: {
    brand: string
    last4: string
    exp_month: number
    exp_year: number
  }
}

export type OrganizationPaymentMethod =
  | OrganizationPaymentMethodCard
  | {
      id: string
      type: string
      default: boolean
    }

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

// TODO: Endpoint `/v1/organizations/{id}/payment-methods` does not exist yet.
// Backend needs to expose payment-method CRUD via polar_self_service. Once it
// does, swap the placeholder implementation below for a real api.GET/POST call
// and drop the OrganizationPaymentMethod* placeholder types above in favour of
// the generated `schemas['...']` types.
export const useOrganizationPaymentMethods = (organizationId: string) =>
  useQuery({
    queryKey: ['organization-billing', organizationId, 'payment-methods'],
    // TODO: replace with
    //   unwrap(api.GET('/v1/organizations/{id}/payment-methods', { params: { path: { id: organizationId } } }))
    queryFn: async (): Promise<{ items: OrganizationPaymentMethod[] }> => ({
      items: [],
    }),
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

// TODO: DELETE `/v1/organizations/{id}/payment-methods/{payment_method_id}`
export const useDeleteOrganizationPaymentMethod = (organizationId: string) =>
  useMutation({
    mutationFn: async (paymentMethodId: string): Promise<void> => {
      void paymentMethodId
      throw new Error('Organization payment methods are not yet supported.')
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['organization-billing', organizationId, 'payment-methods'],
      })
    },
  })

export type OrganizationBillingDetails = {
  billing_name: string | null
  billing_address: schemas['AddressInput'] | null
  tax_id: string | null
}

// TODO: GET `/v1/organizations/{id}/billing-details`
export const useOrganizationBillingDetails = (organizationId: string) =>
  useQuery({
    queryKey: ['organization-billing', organizationId, 'billing-details'],
    queryFn: async (): Promise<OrganizationBillingDetails> => ({
      billing_name: null,
      billing_address: null,
      tax_id: null,
    }),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

// TODO: PATCH `/v1/organizations/{id}/billing-details`
export const useUpdateOrganizationBillingDetails = (organizationId: string) =>
  useMutation({
    mutationFn: async (
      body: OrganizationBillingDetails,
    ): Promise<OrganizationBillingDetails> => {
      void body
      throw new Error(
        'Updating organization billing details is not yet supported.',
      )
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['organization-billing', organizationId, 'billing-details'],
      })
    },
  })
