import {
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { api, queryClient } from '../../api'
import { PaymentMethod, Platforms, Pledge } from '../../api/client'
import { defaultRetry } from './retry'

export const useGetPledge: (
  pledgeId?: string,
) => UseQueryResult<Pledge, Error> = (pledgeId?: string) =>
  useQuery({
    queryKey: ['pledge', pledgeId],
    queryFn: () =>
      api.pledges.get({
        id: pledgeId || '',
      }),
    enabled: !!pledgeId,
    retry: defaultRetry,
  })

export const useListPledesForIssue = (issueId?: string) =>
  useQuery({
    queryKey: ['pledge', 'byIssue', issueId],
    queryFn: () =>
      api.pledges.search({
        issueId: issueId || '',
      }),

    enabled: !!issueId,
    retry: defaultRetry,
  })

export const useListPledgesForOrganization = (
  platform?: Platforms,
  orgName?: string,
) =>
  useQuery({
    queryKey: ['pledge', 'list', platform, orgName],
    queryFn: () =>
      api.pledges.search({
        platform: platform || Platforms.GITHUB,
        organizationName: orgName || '',
      }),

    retry: defaultRetry,
    enabled: !!platform && !!orgName,
  })

export const useListPaymentMethods = () =>
  useQuery({
    queryKey: ['paymentMethods'],
    queryFn: () => api.paymentMethods.list(),
    retry: defaultRetry,
  })

export const useDetachPaymentMethodMutation: () => UseMutationResult<
  PaymentMethod,
  Error,
  {
    id: string
  },
  unknown
> = () =>
  useMutation({
    mutationFn: (variables: { id: string }) => {
      return api.paymentMethods.detach(variables)
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods'] })
    },
  })
