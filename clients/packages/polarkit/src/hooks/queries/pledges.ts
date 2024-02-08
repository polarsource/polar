import {
  PaymentMethod,
  Platforms,
  Pledge,
  PledgesApiSearchRequest,
} from '@polar-sh/sdk'
import {
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { api, queryClient } from '../../api'
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
    queryKey: ['pledgeByIssue', issueId],
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
    queryKey: ['pledgeList', platform, orgName],
    queryFn: () =>
      api.pledges.search({
        platform: platform || Platforms.GITHUB,
        organizationName: orgName || '',
      }),

    retry: defaultRetry,
    enabled: !!platform && !!orgName,
  })

export const useSearchPledges = (search: PledgesApiSearchRequest) =>
  useQuery({
    queryKey: ['pledgeSearch', JSON.stringify(search)],
    queryFn: () => api.pledges.search(search),
    retry: defaultRetry,
    enabled:
      Boolean(search.byOrganizationId) ||
      Boolean(search.organizationName) ||
      Boolean(search.byUserId),
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

export const useSpending = (organizationId: string) =>
  useQuery({
    queryKey: ['spending', organizationId],
    queryFn: () => api.pledges.spending({ organizationId }),
    retry: defaultRetry,
  })
