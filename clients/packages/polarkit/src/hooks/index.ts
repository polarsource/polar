import { api } from '../api'
import { useQuery } from '@tanstack/react-query'
import { useProvideAuth, useAuth, requireAuth } from './auth'

export const useDemos = () => useQuery(['demo'], () => api.demo.getAll())

export const useUserOrganizations = (userId) =>
  useQuery(['user', 'organizations', userId], () =>
    api.userOrganizations.getUserOrganizations(),
  )

export { useProvideAuth, useAuth, requireAuth }
