import { api } from '../api'
import { useQuery } from '@tanstack/react-query'
import { useAuth, requireAuth } from './auth'
import { useGithubOAuthCallback } from './github'
import { useHasHydrated } from './hydration'

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
    () => api.issues.getRepositoryIssues({
      provider: 'github',
      repoOwner,
      repoName,
    }),
    {
      enabled: !!repoOwner && !!repoName,
    },
  )

export { useAuth, requireAuth, useGithubOAuthCallback, useHasHydrated }
