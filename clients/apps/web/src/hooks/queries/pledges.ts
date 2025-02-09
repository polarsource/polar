import { queryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useGetPledge = (pledgeId: string | null) =>
  useQuery({
    queryKey: ['pledge', pledgeId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/pledges/{id}', {
          params: { path: { id: pledgeId ?? '' } },
        }),
      ),
    enabled: !!pledgeId,
    retry: defaultRetry,
  })

export const useSearchPledges = (
  params: operations['pledges:search']['parameters']['query'],
) =>
  useQuery({
    queryKey: ['pledges', { ...params }],
    queryFn: () =>
      unwrap(api.GET('/v1/pledges/search', { params: { query: params } })),
    retry: defaultRetry,
  })

export const useListPledesForIssue = (issueId: string) =>
  useSearchPledges({ issue_id: issueId })

export const useListPledgesForOrganization = (organizationId: string) =>
  useSearchPledges({ organization_id: organizationId })

export const useListPaymentMethods = () =>
  useQuery({
    queryKey: ['paymentMethods'],
    queryFn: () => unwrap(api.GET('/v1/payment_methods')),
    retry: defaultRetry,
  })

export const useDetachPaymentMethodMutation = () =>
  useMutation({
    mutationFn: (variables: { id: string }) => {
      return api.POST('/v1/payment_methods/{id}/detach', {
        params: { path: { id: variables.id } },
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({ queryKey: ['paymentMethods'] })
    },
  })
