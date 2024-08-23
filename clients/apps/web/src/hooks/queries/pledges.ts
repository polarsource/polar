import { api, queryClient } from '@/utils/api'
import { PaymentMethod, Pledge, PledgesApiSearchRequest } from '@polar-sh/sdk'
import {
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useGetPledge: (
  pledgeId: string | null,
) => UseQueryResult<Pledge, Error> = (pledgeId: string | null) =>
  useQuery({
    queryKey: ['pledge', pledgeId],
    queryFn: () =>
      api.pledges.get({
        id: pledgeId || '',
      }),
    enabled: !!pledgeId,
    retry: defaultRetry,
  })

export const useSearchPledges = (params: PledgesApiSearchRequest) =>
  useQuery({
    queryKey: ['pledges', { ...params }],
    queryFn: () => api.pledges.search(params),
    retry: defaultRetry,
  })

export const useListPledesForIssue = (issueId: string) =>
  useSearchPledges({ issueId })

export const useListPledgesForOrganization = (organizationId: string) =>
  useSearchPledges({ organizationId })

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
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods'] })
    },
  })

export const useSpending = (organizationId: string) =>
  useQuery({
    queryKey: ['spending', organizationId],
    queryFn: () => api.pledges.spending({ organizationId }),
    retry: defaultRetry,
  })
