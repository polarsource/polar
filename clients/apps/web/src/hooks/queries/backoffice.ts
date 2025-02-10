import { queryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useBackofficeAllPledges = () =>
  useQuery({
    queryKey: ['backofficeAllPledges'],
    queryFn: () => unwrap(api.GET('/v1/backoffice/pledges')),
  })

export const useBackofficeRewards = (issueId?: string) =>
  useQuery({
    queryKey: ['useBackofficeRewards', issueId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/backoffice/rewards/by_issue', {
          params: {
            query: {
              issue_id: issueId,
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!issueId,
  })

export const useBackofficeRewardsPending = () =>
  useQuery({
    queryKey: ['useBackofficeRewardsPending'],
    queryFn: () => unwrap(api.GET('/v1/backoffice/rewards/pending')),
    retry: defaultRetry,
  })

export const useBackofficeIssue = (issueId?: string) =>
  useQuery({
    queryKey: ['useBackofficeIssue', issueId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/backoffice/issue/{id}', {
          params: {
            path: {
              id: issueId || '',
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!issueId,
  })

export const useBackofficePledgeRewardTransfer = () =>
  useMutation({
    mutationFn: (variables: { pledgeId: string; issueRewardId: string }) => {
      return api.POST('/v1/backoffice/pledges/approve', {
        body: {
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
      return api.POST('/v1/backoffice/pledges/mark_disputed/{pledge_id}', {
        params: {
          path: {
            pledge_id: variables.pledgeId,
          },
        },
      })
    },
    onSuccess: async (_result, _variables, _ctx) => {
      await invalidateBackofficePledges()
    },
  })

export const useBackofficeBadgeAction = () =>
  useMutation({
    mutationFn: (badgeAction: schemas['BackofficeBadge']) => {
      return api.POST('/v1/backoffice/badge', { body: badgeAction })
    },
  })

export const useBackofficePledgeCreateInvoice = () =>
  useMutation({
    mutationFn: (variables: { pledgeId: string }) => {
      return api.POST('/v1/backoffice/pledges/create_invoice/{pledge_id}', {
        params: {
          path: {
            pledge_id: variables.pledgeId,
          },
        },
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
