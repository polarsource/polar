import {
  BackofficeBadge,
  BackofficePledge,
  BackofficeReward,
} from '@polar-sh/sdk'
import {
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { api, queryClient } from '../../api'
import { defaultRetry } from './retry'

export const useBackofficeAllPledges: () => UseQueryResult<
  BackofficePledge[],
  string
> = () =>
  useQuery({
    queryKey: ['backofficeAllPledges'],
    queryFn: () => api.backoffice.pledges(),
  })

export const useBackofficeRewards = (issueId?: string) =>
  useQuery({
    queryKey: ['useBackofficeRewards', issueId],
    queryFn: () =>
      api.backoffice.rewards({
        issueId,
      }),
    retry: defaultRetry,
    enabled: !!issueId,
  })

export const useBackofficeRewardsPending = () =>
  useQuery({
    queryKey: ['useBackofficeRewardsPending'],
    queryFn: () => api.backoffice.rewardsPending(),
    retry: defaultRetry,
  })

export const useBackofficeIssue = (issueId?: string) =>
  useQuery({
    queryKey: ['useBackofficeIssue', issueId],
    queryFn: () =>
      api.backoffice.issue({
        id: issueId || '',
      }),
    retry: defaultRetry,
    enabled: !!issueId,
  })

export const useBackofficePledgeRewardTransfer: () => UseMutationResult<
  BackofficeReward,
  Error,
  { pledgeId: string; issueRewardId: string },
  unknown
> = () =>
  useMutation({
    mutationFn: (variables: { pledgeId: string; issueRewardId: string }) => {
      return api.backoffice.pledgeRewardTransfer({
        pledgeRewardTransfer: {
          pledge_id: variables.pledgeId,
          issue_reward_id: variables.issueRewardId,
        },
      })
    },
    onSuccess: async (_result, _variables, _ctx) => {
      await invalidateBackofficePledges()
    },
  })

export const useBackofficePledgeMarkDisputed = () =>
  useMutation({
    mutationFn: (variables: { pledgeId: string }) => {
      return api.backoffice.pledgeMarkDisputed({
        pledgeId: variables.pledgeId,
      })
    },
    onSuccess: async (_result, _variables, _ctx) => {
      await invalidateBackofficePledges()
    },
  })

export const useBackofficeBadgeAction = () =>
  useMutation({
    mutationFn: (badgeAction: BackofficeBadge) => {
      return api.backoffice.manageBadge({
        backofficeBadge: badgeAction,
      })
    },
  })

export const useBackofficePledgeCreateInvoice = () =>
  useMutation({
    mutationFn: (variables: { pledgeId: string }) => {
      return api.backoffice.pledgeCreateInvoice({
        pledgeId: variables.pledgeId,
      })
    },
    onSuccess: async (_result, _variables, _ctx) => {
      await invalidateBackofficePledges()
    },
  })

const invalidateBackofficePledges = async () => {
  await queryClient.invalidateQueries({ queryKey: ['backofficeAllPledges'] })
  await queryClient.invalidateQueries({ queryKey: ['useBackofficeRewards'] })
  await queryClient.invalidateQueries({
    queryKey: ['useBackofficeRewardsPending'],
  })
}
