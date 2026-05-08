import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

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
