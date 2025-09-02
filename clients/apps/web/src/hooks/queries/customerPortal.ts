import { queryClient } from '@/utils/api/query'
import { Client, operations, schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useCustomerPortalSessionRequest = (
  api: Client,
  organizationId: string,
) =>
  useMutation({
    mutationFn: async ({ email }: { email: string }) =>
      api.POST('/v1/customer-portal/customer-session/request', {
        body: {
          email,
          organization_id: organizationId,
        },
      }),
  })

export const useCustomerPortalSessionAuthenticate = (api: Client) =>
  useMutation({
    mutationFn: ({ code }: { code: string }) =>
      api.POST('/v1/customer-portal/customer-session/authenticate', {
        body: { code },
      }),
  })

export const useAuthenticatedCustomer = (api: Client) =>
  useQuery({
    queryKey: ['customer'],
    queryFn: () => unwrap(api.GET('/v1/customer-portal/customers/me')),
    retry: defaultRetry,
  })

export const useUpdateCustomerPortal = (api: Client) =>
  useMutation({
    mutationFn: async (body: schemas['CustomerPortalCustomerUpdate']) =>
      api.PATCH('/v1/customer-portal/customers/me', {
        body,
      }),
    onSuccess: async (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['customer'],
      })
    },
  })

export const useCustomerPaymentMethods = (api: Client) =>
  useQuery({
    queryKey: ['customer_payment_methods'],
    queryFn: () =>
      unwrap(api.GET('/v1/customer-portal/customers/me/payment-methods')),
    retry: defaultRetry,
  })

export const useAddCustomerPaymentMethod = (api: Client) =>
  useMutation({
    mutationFn: async (body: schemas['CustomerPaymentMethodCreate']) =>
      api.POST('/v1/customer-portal/customers/me/payment-methods', {
        body,
      }),
    onSuccess: async (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['customer_payment_methods'],
      })
    },
  })

export const useDeleteCustomerPaymentMethod = (api: Client) =>
  useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE('/v1/customer-portal/customers/me/payment-methods/{id}', {
        params: { path: { id } },
      })
      if (result.error) {
        const errorMessage = typeof result.error.detail === 'string' 
          ? result.error.detail 
          : 'Failed to delete payment method'
        throw new Error(errorMessage)
      }
      return result
    },
    onSuccess: async (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['customer_payment_methods'],
      })
    },
  })

export const useCustomerBenefitGrants = (
  api: Client,
  parameters?: operations['customer_portal:benefit-grants:list']['parameters']['query'],
) =>
  useQuery({
    queryKey: ['customer_benefit_grants', { ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/customer-portal/benefit-grants/', {
          params: { query: parameters },
        }),
      ),
    retry: defaultRetry,
  })

export const useCustomerBenefitGrantUpdate = (api: Client) =>
  useMutation({
    mutationFn: (variables: {
      id: string
      body: schemas['CustomerBenefitGrantUpdate']
    }) =>
      api.PATCH('/v1/customer-portal/benefit-grants/{id}', {
        params: { path: { id: variables.id } },
        body: variables.body,
      }),
    onSuccess: async (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['customer_benefit_grants'],
      })
    },
  })

export const useCustomerLicenseKeys = (
  api: Client,
  parameters: operations['customer_portal:license_keys:list']['parameters']['query'],
) =>
  useQuery({
    queryKey: ['customer_license_keys', { parameters }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/customer-portal/license-keys/', {
          params: { query: parameters },
        }),
      ),
    retry: defaultRetry,
  })

export const useCustomerLicenseKey = (api: Client, id: string) =>
  useQuery({
    queryKey: ['customer_license_keys', { id }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/customer-portal/license-keys/{id}', {
          params: { path: { id } },
        }),
      ),
    retry: defaultRetry,
  })

export const useCustomerLicenseKeyDeactivate = (api: Client, id: string) =>
  useMutation({
    mutationFn: (opts: {
      key: string
      organizationId: string
      activationId: string
    }) =>
      api.POST('/v1/customer-portal/license-keys/deactivate', {
        body: {
          key: opts.key,
          organization_id: opts.organizationId,
          activation_id: opts.activationId,
        },
      }),
    onSuccess: async (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['customer_license_keys', { id }],
      })
    },
  })

export const useCustomerDownloadables = (
  api: Client,
  parameters?: operations['customer_portal:downloadables:list']['parameters']['query'],
) =>
  useQuery({
    queryKey: ['customer_downloadables', { ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/customer-portal/downloadables/', {
          params: { query: parameters },
        }),
      ),
    retry: defaultRetry,
  })

export const useCustomerOrder = (
  api: Client,
  id: string,
  initialData?: schemas['CustomerOrder'],
) =>
  useQuery({
    queryKey: ['customer_order', { id }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/customer-portal/orders/{id}', {
          params: { path: { id } },
        }),
      ),
    retry: defaultRetry,
    initialData,
  })

export const useCustomerOrders = (
  api: Client,
  parameters?: operations['customer_portal:orders:list']['parameters']['query'],
) =>
  useQuery({
    queryKey: ['customer_orders', { ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/customer-portal/orders/', {
          params: { query: parameters },
        }),
      ),
    retry: defaultRetry,
  })

export const useCustomerSubscriptions = (
  api: Client,
  parameters?: operations['customer_portal:subscriptions:list']['parameters']['query'],
) =>
  useQuery({
    queryKey: ['customer_subscriptions', { ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/customer-portal/subscriptions/', {
          params: { query: parameters },
        }),
      ),
    retry: defaultRetry,
  })

export const useCustomerUpdateSubscription = (api: Client) =>
  useMutation({
    mutationFn: (variables: {
      id: string
      body: schemas['CustomerSubscriptionUpdate']
    }) =>
      api.PATCH('/v1/customer-portal/subscriptions/{id}', {
        params: { path: { id: variables.id } },
        body: variables.body,
      }),
    onSuccess: (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['customer_subscriptions'],
      })
    },
  })

export const useCustomerCancelSubscription = (api: Client) =>
  useMutation({
    mutationFn: (variables: {
      id: string
      body: schemas['CustomerSubscriptionCancel']
    }) =>
      api.PATCH('/v1/customer-portal/subscriptions/{id}', {
        params: { path: { id: variables.id } },
        body: variables.body,
      }),
    onSuccess: (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['customer_subscriptions'],
      })
    },
  })

export const useCustomerUncancelSubscription = (api: Client) =>
  useMutation({
    mutationFn: (variables: { id: string }) =>
      api.PATCH('/v1/customer-portal/subscriptions/{id}', {
        params: { path: { id: variables.id } },
        body: {
          cancel_at_period_end: false,
          cancellation_reason: null,
          cancellation_comment: null,
        },
      }),
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['customer_subscriptions'],
      })
    },
  })

export const useCustomerCustomerMeters = (
  api: Client,
  parameters?: operations['customer_portal:customer_meters:list']['parameters']['query'],
) =>
  useQuery({
    queryKey: ['customer_customer_meters', { parameters }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/customer-portal/meters/', {
          params: {
            query: parameters || {},
          },
        }),
      ),
    retry: defaultRetry,
  })

export const useCustomerOrderConfirmPayment = (api: Client) =>
  useMutation({
    mutationFn: async (variables: {
      orderId: string
      confirmation_token_id?: string
      payment_method_id?: string
      payment_processor?: schemas['PaymentProcessor']
    }) =>
      api.POST('/v1/customer-portal/orders/{id}/confirm-payment', {
        params: { path: { id: variables.orderId } },
        body: {
          ...(variables.confirmation_token_id && {
            confirmation_token_id: variables.confirmation_token_id,
          }),
          ...(variables.payment_method_id && {
            payment_method_id: variables.payment_method_id,
          }),
          payment_processor: variables.payment_processor || 'stripe',
        } as any,
      }),
    onSuccess: async (result, variables, _ctx) => {
      if (result.error) {
        return
      }
      // Invalidate order queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ['customer_order', { id: variables.orderId }],
      })
      queryClient.invalidateQueries({
        queryKey: ['customer_orders'],
      })
    },
  })

export const useCustomerOrderPaymentStatus = (api: Client) =>
  useMutation({
    mutationFn: async (variables: { orderId: string }) =>
      api.GET('/v1/customer-portal/orders/{id}/payment-status', {
        params: { path: { id: variables.orderId } },
      }),
  })
