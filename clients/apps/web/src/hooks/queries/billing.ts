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

export const useOrganizationOrders = (organizationId: string | undefined) =>
  useQuery({
    queryKey: ['organization-billing', organizationId, 'orders'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/orders', {
          params: {
            path: { id: organizationId ?? '' },
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

export const useOrganizationPlans = (organizationId: string | undefined) =>
  useQuery({
    queryKey: ['organization-billing', organizationId, 'plans'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/plans', {
          params: { path: { id: organizationId ?? '' } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useOrganizationSubscription = (
  organizationId: string | undefined,
) =>
  useQuery({
    queryKey: ['organization-billing', organizationId, 'subscription'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/subscription', {
          params: { path: { id: organizationId ?? '' } },
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

export const useClaimStartupProgram = (organizationId: string) =>
  useMutation({
    mutationFn: (body: schemas['OrganizationStartupProgramClaimRequest']) =>
      api.POST('/v1/organizations/{id}/startup-program/claim', {
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

export const useCancelSubscription = (organizationId: string) =>
  useMutation({
    mutationFn: () =>
      api.DELETE('/v1/organizations/{id}/subscription', {
        params: { path: { id: organizationId } },
      }),
    onSuccess: (result) => {
      if (result.error) return
      getQueryClient().invalidateQueries({
        queryKey: ['organization-billing', organizationId, 'subscription'],
      })
    },
  })

export const useOrganizationCustomerSession = (organizationId: string) =>
  useQuery({
    queryKey: ['organization-billing', organizationId, 'customer-session'],
    queryFn: () =>
      unwrap(
        api.POST('/v1/organizations/{id}/customer-session', {
          params: { path: { id: organizationId } },
        }),
      ),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  })

export const useOrganizationPaymentMethods = (
  organizationId: string | undefined,
) =>
  useQuery({
    queryKey: ['organization-billing', organizationId, 'payment-methods'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/payment-methods', {
          params: { path: { id: organizationId ?? '' } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useDeleteOrganizationPaymentMethod = (organizationId: string) =>
  useMutation({
    mutationFn: (paymentMethodId: string) =>
      api.DELETE('/v1/organizations/{id}/payment-methods/{payment_method_id}', {
        params: {
          path: { id: organizationId, payment_method_id: paymentMethodId },
        },
      }),
    onSuccess: (result) => {
      if (result.error) return
      getQueryClient().invalidateQueries({
        queryKey: ['organization-billing', organizationId, 'payment-methods'],
      })
    },
  })

export const useSetDefaultOrganizationPaymentMethod = (
  organizationId: string,
) =>
  useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const result = await api.POST(
        '/v1/organizations/{id}/payment-methods/{payment_method_id}/default',
        {
          params: {
            path: { id: organizationId, payment_method_id: paymentMethodId },
          },
        },
      )
      if (result.error) {
        const errorMessage =
          typeof result.error.detail === 'string'
            ? result.error.detail
            : 'Failed to update default payment method'
        throw new Error(errorMessage)
      }
      return result
    },
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['organization-billing', organizationId, 'payment-methods'],
      })
    },
  })

export type OrganizationBillingDetails = schemas['OrganizationBillingDetails']
export type OrganizationBillingDetailsUpdate =
  schemas['OrganizationBillingDetailsUpdate']

export const useOrganizationBillingDetails = (
  organizationId: string | undefined,
) =>
  useQuery({
    queryKey: ['organization-billing', organizationId, 'billing-details'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/billing-details', {
          params: { path: { id: organizationId ?? '' } },
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

export type OrganizationBenefitGrant = schemas['OrganizationBenefitGrant']

const isGrantProvisioning = (grant: OrganizationBenefitGrant) =>
  !!grant.invited_email && !grant.is_granted && !grant.error_message

export const useOrganizationBenefitGrants = (
  organizationId: string | undefined,
) =>
  useQuery({
    queryKey: ['organization-billing', organizationId, 'benefit-grants'],
    queryFn: () =>
      unwrap(
        api.GET('/v1/organizations/{id}/benefit-grants', {
          params: { path: { id: organizationId ?? '' } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
    refetchInterval: (query) =>
      query.state.data?.items.some(isGrantProvisioning) ? 2000 : false,
  })

export const useUpdateOrganizationBenefitGrant = (organizationId: string) =>
  useMutation({
    mutationFn: (variables: {
      benefitGrantId: string
      body: schemas['OrganizationBenefitGrantUpdate']
    }) =>
      unwrap(
        api.PATCH('/v1/organizations/{id}/benefit-grants/{benefit_grant_id}', {
          params: {
            path: {
              id: organizationId,
              benefit_grant_id: variables.benefitGrantId,
            },
          },
          body: variables.body,
        }),
      ),
    onSuccess: () => {
      getQueryClient().invalidateQueries({
        queryKey: ['organization-billing', organizationId, 'benefit-grants'],
      })
    },
  })
