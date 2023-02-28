import { api } from '../../api'
import { useQuery } from '@tanstack/react-query'
import { RepositorySchema, OrganizationSchema } from 'polarkit/api/client'
import { Platforms } from '../../api/client'

export const useDemos = () => useQuery(['demo'], () => api.demo.getAll())

export type RepoListItem = RepositorySchema & {
  organization: OrganizationSchema
}

export const useUserOrganizations = (userId: string) => {
  const query = useQuery(
    ['user', 'organizations', userId],
    () => api.userOrganizations.getUserOrganizations(),
    {
      enabled: !!userId,
    },
  )

  let repositories: RepoListItem[] | undefined
  if (query.isSuccess) {
    const organizations = query.data
    repositories = organizations
      .map((org) => {
        return org.repositories.map((repo) => {
          return {
            ...repo,
            organization: org,
          }
        })
      })
      .flat()
  }

  return {
    ...query,
    repositories,
    findBySlug: (orgSlug: string, repoSlug: string) => {
      if (!repositories) return undefined

      return repositories.find(
        (repo) => repo.organization.slug === orgSlug && repo.slug === repoSlug,
      )
    },
  }
  return query
}

export const useRepositoryIssues = (repoOwner: string, repoName: string) =>
  useQuery(
    ['issues', 'repo', repoOwner, repoName],
    () =>
      api.issues.getRepositoryIssues({
        platform: Platforms.GITHUB,
        organizationName: repoOwner,
        name: repoName,
      }),
    {
      enabled: !!repoOwner && !!repoName,
    },
  )

export const useRepositoryPullRequests = (
  repoOwner: string,
  repoName: string,
) =>
  useQuery(
    ['pull_requests', 'repo', repoOwner, repoName],
    () =>
      api.pullRequests.getRepositoryPullRequests({
        platform: Platforms.GITHUB,
        organizationName: repoOwner,
        name: repoName,
      }),
    {
      enabled: !!repoOwner && !!repoName,
    },
  )
