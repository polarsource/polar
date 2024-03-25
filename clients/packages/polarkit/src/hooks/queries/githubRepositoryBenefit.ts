import { GitHubInvitesBenefitRepositories, ResponseError } from '@polar-sh/sdk'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { api } from '../../..'
import { defaultRetry } from './retry'

export const useListIntegrationsGithubRepositoryBenefitUserRepositories: () => UseQueryResult<
  GitHubInvitesBenefitRepositories,
  ResponseError
> = () =>
  useQuery({
    queryKey: ['integrationsGithubRepositoryBenefitUserRepositories'],
    queryFn: () =>
      api.integrationsGitHubRepositoryBenefit.integrationsGithubRepositoryBenefitUserRepositories(),
    retry: defaultRetry,
  })
