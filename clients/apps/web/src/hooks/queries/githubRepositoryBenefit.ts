import { api } from '@/utils/api'
import { GitHubInvitesBenefitRepositories, ResponseError } from '@polar-sh/api'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
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
