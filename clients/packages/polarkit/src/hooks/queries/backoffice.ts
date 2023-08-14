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

export const useBackofficePledgeApprove = () =>
  useMutation({
    mutationFn: (variables: { pledgeId: string }) => {
      return api.backoffice.pledgeApprove({
        pledgeId: variables.pledgeId,
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

export const useBackofficeListInvites = () =>
  useQuery(['useBackofficeListInvites'], () => api.backoffice.invitesList(), {
    retry: defaultRetry,
  })

export const useBackofficeCreateInviteCode = () =>
  useMutation({
    mutationFn: (note?: string | undefined) => {
      return api.backoffice.invitesCreateCode({
        requestBody: {
          note,
        },
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries(['useBackofficeListInvites'])
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
