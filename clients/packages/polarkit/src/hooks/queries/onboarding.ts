import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { Platforms } from '../../api/client'
import { defaultRetry } from './retry'

export const useOrganizationsRepositorySyncedIssues = (
  platform: Platforms,
  orgName: string,
) =>
  useQuery(
    ['organizationsRepositorySyncedIssues'],
    () =>
      api.organizations.getSynced({
        platform: platform,
        orgName: orgName,
      }),
    {
      retry: defaultRetry,
    },
  )
