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
    onSuccess: async (result, variables, ctx) => {
      await queryClient.invalidateQueries(['dashboard'])
      await queryClient.invalidateQueries(['pledge'])
      await queryClient.invalidateQueries(['listPersonalPledges'])
    },
  })

export const useListPledgesForOrganization = (
  platform: Platforms,
  orgName: string,
) =>
  useQuery(
    ['pledge', 'list', platform, orgName],
    () =>
      api.pledges.listOrganizationPledges({
        platform,
        orgName,
      }),
    {
      retry: defaultRetry,
    },
  )
