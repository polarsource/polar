import { api } from '../../api'
import { useQuery } from '@tanstack/react-query'
import { type RepositoryRead, type OrganizationRead } from 'polarkit/api/client'
import { Platforms } from '../../api/client'

export type RepoListItem = RepositoryRead & {
  organization: OrganizationRead
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

export const useRepositoryRewards = (repoOwner: string, repoName: string) =>
  useQuery(
    ['rewards', 'repo', repoOwner, repoName],
    () =>
      api.rewards.getRepositoryRewards({
        platform: Platforms.GITHUB,
        organizationName: repoOwner,
        name: repoName,
      }),
    {
      enabled: !!repoOwner && !!repoName,
    },
  )

export const useDashboard = (repoOwner: string, repoName: string, q?: string) =>
  useQuery(
    ['dashboard', 'repo', repoOwner, repoName,  q],
    () =>
      api.dashboard.getDashboard({
        platform: Platforms.GITHUB,
        organizationName: repoOwner,
        repositoryName: repoName,
        q: q,
      }),
    {
      enabled: !!repoOwner && !!repoName,
    },
  )
