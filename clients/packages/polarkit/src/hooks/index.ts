import { api } from '../api'
import { useQuery } from '@tanstack/react-query'
import { useAuth, requireAuth, useOAuthExchange } from './auth'
import { useHasHydrated } from './hydration'

export const useDemos = () => useQuery(['demo'], () => api.demo.getAll())

export const useUserOrganizations = (userId: number) =>
  useQuery(['user', 'organizations', userId], () =>
    api.userOrganizations.getUserOrganizations(),
  )

export { useAuth, requireAuth, useOAuthExchange, useHasHydrated }
