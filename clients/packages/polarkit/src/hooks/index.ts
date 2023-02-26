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

export { useAuth, requireAuth, useGithubOAuthCallback, useHasHydrated }
