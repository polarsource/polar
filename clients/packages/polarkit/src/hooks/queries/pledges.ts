import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { Platforms } from '../../api/client'
import { queryClient } from '../../api/query'
import { defaultRetry } from './retry'

export const useListPersonalPledges = () =>
  useQuery(['listPersonalPledges'], () => api.pledges.listPersonalPledges(), {
    retry: defaultRetry,
  })

export const useGetPledge = (
  platform: Platforms,
  orgName: string,
  repoName: string,
  number: number,
  pledgeId: string | undefined,
) =>
  useQuery(
    ['pledge', pledgeId],
    () =>
      api.pledges.getPledge({
        platform,
        orgName,
        repoName,
        number,
        pledgeId: pledgeId || '',
      }),
    {
      enabled: !!pledgeId,
      retry: defaultRetry,
    },
  )

export const useIssueMarkConfirmed = () =>
  useMutation({
    mutationFn: (variables: {
      platform: string
      orgName: string
      repoName: string
      issueNumber: number
    }) => {
      return api.pledges.confirmPledges({
        platform: Platforms.GITHUB,
        orgName: variables.orgName,
        repoName: variables.repoName,
        number: variables.issueNumber,
      })
    },
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries(['dashboard'])
      queryClient.invalidateQueries(['pledge'])
    },
  })
