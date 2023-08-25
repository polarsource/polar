import { useMutation, useQuery } from '@tanstack/react-query'
import { api, queryClient } from '../../api'
import { BackofficeBadge } from '../../api/client'
import { defaultRetry } from './retry'

export const useBackofficeAllPledges = () =>
  useQuery(['backofficeAllPledges'], () => api.backoffice.pledges(), {
    retry: defaultRetry,
  })

export const useBackofficeRewards = (issueId?: string) =>
  useQuery(
    ['useBackofficeRewards', issueId],
    () =>
      api.backoffice.rewards({
        issueId,
      }),
    {
      retry: defaultRetry,
      enabled: !!issueId,
    },
  )

export const useBackofficeRewardsPending = () =>
  useQuery(
    ['useBackofficeRewardsPending'],
    () => api.backoffice.rewardsPending(),
    {
      retry: defaultRetry,
    },
  )

export const useBackofficeIssue = (issueId?: string) =>
  useQuery(
    ['useBackofficeIssue', issueId],
    () =>
      api.backoffice.issue({
        id: issueId || '',
      }),
    {
      retry: defaultRetry,
      enabled: !!issueId,
    },
  )

export const useBackofficePledgeRewardTransfer = () =>
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
      queryClient.invalidateQueries(['backofficeAllPledges'])
      queryClient.invalidateQueries(['useBackofficeRewards'])
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
      queryClient.invalidateQueries(['backofficeAllPledges'])
      queryClient.invalidateQueries(['useBackofficeRewards'])
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
      queryClient.invalidateQueries(['backofficeAllPledges'])
      queryClient.invalidateQueries(['useBackofficeRewards'])
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
