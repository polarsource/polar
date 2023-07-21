import { useMutation, useQuery } from '@tanstack/react-query'
import { api, queryClient } from '../../api'
import { PledgeRead } from '../../api/client'
import { BackofficeBadge } from '../../api/client'
import { defaultRetry } from './retry'

export const useBackofficeAllPledges = () =>
  useQuery(['backofficeAllPledges'], () => api.backoffice.pledges(), {
    retry: defaultRetry,
  })

export const useBackofficeAllNonCustomerPledges = () =>
  useQuery(
    ['backofficeAllNonCustomerPledges'],
    () => api.backoffice.pledgesNonCustomers(),
    {
      retry: defaultRetry,
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
      queryClient.setQueryData<Array<PledgeRead> | undefined>(
        ['backofficeAllPledges'],
        (oldData) =>
          oldData
            ? oldData.map((p) => (p.id === result.id ? result : p))
            : oldData,
      )
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
      queryClient.setQueryData<Array<PledgeRead> | undefined>(
        ['backofficeAllPledges'],
        (oldData) =>
          oldData
            ? oldData.map((p) => (p.id === result.id ? result : p))
            : oldData,
      )
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
      queryClient.setQueryData<Array<PledgeRead> | undefined>(
        ['backofficeAllPledges'],
        (oldData) =>
          oldData
            ? oldData.map((p) => (p.id === result.id ? result : p))
            : oldData,
      )
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
        requestBody: badgeAction
      })
    }
  })
