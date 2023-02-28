import { api } from '../api'
import { useQuery } from '@tanstack/react-query'
import { useAuth, requireAuth } from './auth'
import { useGithubOAuthCallback } from './github'
import { useHasHydrated } from './hydration'
import { Platforms } from 'polarkit/api/client'

export const useDemos = () => useQuery(['demo'], () => api.demo.getAll())

export const useUserOrganizations = (userId: string) =>
  useQuery(
    ['user', 'organizations', userId],
    () => api.userOrganizations.getUserOrganizations(),
    {
      enabled: !!userId,
    },
  )

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

export { useAuth, requireAuth, useGithubOAuthCallback, useHasHydrated }
