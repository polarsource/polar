import { queryClient } from '@/utils/api'
import {
  CustomerBenefitGrantUpdate,
  CustomerPortalBenefitGrantsApiListRequest,
  CustomerPortalDownloadablesApiListRequest,
  CustomerPortalLicenseKeysApiListRequest,
  CustomerPortalOrdersApiListRequest,
  CustomerPortalSubscriptionsApiListRequest,
  CustomerSubscriptionCancel,
  CustomerSubscriptionUpdate,
  PolarAPI,
} from '@polar-sh/sdk'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useCustomerPortalSessionRequest = (
  api: PolarAPI,
  organizationId: string,
) =>
  useMutation({
    mutationFn: ({ email }: { email: string }) =>
      api.customerPortalCustomerSession.customerPortalCustomerSessionRequest({
        body: { email, organization_id: organizationId },
      }),
  })

export const useCustomerPortalSessionAuthenticate = (api: PolarAPI) =>
  useMutation({
    mutationFn: ({ code }: { code: string }) =>
      api.customerPortalCustomerSession.customerPortalCustomerSessionAuthenticate(
        {
          body: { code },
        },
      ),
  })

export const useCustomerPortalCustomer = (api: PolarAPI, id: string) =>
  useQuery({
    queryKey: ['customer_portal_customer', { id }],
    queryFn: () => api.customerPortalCustomers.get({ id }),
    retry: defaultRetry,
  })

export const useCustomerBenefitGrants = (
  api: PolarAPI,
  parameters?: CustomerPortalBenefitGrantsApiListRequest,
) =>
  useQuery({
    queryKey: ['customer_benefit_grants', { ...(parameters || {}) }],
    queryFn: () => api.customerPortalBenefitGrants.list(parameters),
    retry: defaultRetry,
  })

export const useCustomerBenefitGrantUpdate = (api: PolarAPI) =>
  useMutation({
    mutationFn: (variables: { id: string; body: CustomerBenefitGrantUpdate }) =>
      api.customerPortalBenefitGrants.update(variables),
    onSuccess: async (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['customer_benefit_grants'],
      })
    },
  })

export const useCustomerLicenseKeys = (
  api: PolarAPI,
  parameters: CustomerPortalLicenseKeysApiListRequest,
) =>
  useQuery({
    queryKey: ['customer_license_keys', { parameters }],
    queryFn: () => api.customerPortalLicenseKeys.list(parameters),
    retry: defaultRetry,
  })

export const useCustomerLicenseKey = (api: PolarAPI, id: string) =>
  useQuery({
    queryKey: ['customer_license_keys', { id }],
    queryFn: () => api.customerPortalLicenseKeys.get({ id }),
    retry: defaultRetry,
  })

export const useCustomerLicenseKeyDeactivate = (api: PolarAPI, id: string) =>
  useMutation({
    mutationFn: (opts: {
      key: string
      organizationId: string
      activationId: string
    }) =>
      api.customerPortalLicenseKeys.deactivate({
        body: {
          key: opts.key,
          organization_id: opts.organizationId,
          activation_id: opts.activationId,
        },
      }),
    onSuccess: async (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['customer_license_keys', { id }],
      })
    },
  })

export const useCustomerDownloadables = (
  api: PolarAPI,
  parameters?: CustomerPortalDownloadablesApiListRequest,
) =>
  useQuery({
    queryKey: ['customer_downloadables', { ...(parameters || {}) }],
    queryFn: () => api.customerPortalDownloadables.list(parameters),
    retry: defaultRetry,
  })

export const useCustomerOrders = (
  api: PolarAPI,
  parameters?: CustomerPortalOrdersApiListRequest,
) =>
  useQuery({
    queryKey: ['customer_orders', { ...(parameters || {}) }],
    queryFn: () => api.customerPortalOrders.list(parameters),
    retry: defaultRetry,
  })

export const useCustomerOrderInvoice = (api: PolarAPI) =>
  useMutation({
    mutationFn: (variables: { id: string }) =>
      api.customerPortalOrders.invoice(variables),
  })

export const useCustomerSubscriptions = (
  api: PolarAPI,
  parameters?: CustomerPortalSubscriptionsApiListRequest,
) =>
  useQuery({
    queryKey: ['customer_subscriptions', { ...(parameters || {}) }],
    queryFn: () => api.customerPortalSubscriptions.list(parameters),
    retry: defaultRetry,
  })

export const useCustomerUpdateSubscription = (api: PolarAPI) =>
  useMutation({
    mutationFn: (variables: {
      id: string
      body: CustomerSubscriptionUpdate
    }) => {
      return api.customerPortalSubscriptions.update({
        id: variables.id,
        body: variables.body,
      })
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['customer_subscriptions'],
      })
    },
  })

export const useCustomerCancelSubscription = (api: PolarAPI) =>
  useMutation({
    mutationFn: (variables: {
      id: string,
      body: CustomerSubscriptionCancel
    }) => {
      return api.customerPortalSubscriptions.update(variables)
    },
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['customer_subscriptions'],
      })
    },
  })
