import {
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { api, queryClient } from '../../api'
import {
  BackofficeBadge,
  BackofficePledge,
  BackofficeReward,
} from '../../api/client'
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
        requestBody: {
          pledge_id: variables.pledgeId,
          issue_reward_id: variables.issueRewardId,
        },
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries({ queryKey: ['backofficeAllPledges'] })
      queryClient.invalidateQueries({ queryKey: ['useBackofficeRewards'] })
    },
  })

export const useBackofficePledgeMarkPending = () =>
  useMutation({
    mutationFn: (variables: { pledgeId: string }) => {
      return api.backoffice.pledgeMarkPending({
        pledgeId: variables.pledgeId,
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries({ queryKey: ['backofficeAllPledges'] })
      queryClient.invalidateQueries({ queryKey: ['useBackofficeRewards'] })
    },
  })

export const useBackofficePledgeMarkDisputed = () =>
  useMutation({
    mutationFn: (variables: { pledgeId: string }) => {
      return api.backoffice.pledgeMarkDisputed({
        pledgeId: variables.pledgeId,
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries({ queryKey: ['backofficeAllPledges'] })
      queryClient.invalidateQueries({ queryKey: ['useBackofficeRewards'] })
    },
  })

export const useBackofficeBadgeAction = () =>
  useMutation({
    mutationFn: (badgeAction: BackofficeBadge) => {
      return api.backoffice.manageBadge({
        requestBody: badgeAction,
      })
    },
  })
