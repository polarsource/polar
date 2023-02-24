import { api } from '../api'
import { useQuery } from '@tanstack/react-query'

export const useDemos = () => useQuery(['demo'], () => api.demo.getAll())

export const useUserOrganizations = (userId: string) =>
  useQuery(['user', 'organizations', userId], () =>
    api.userOrganizations.getUserOrganizations(),
    {
      enabled: !!userId,
    }
  )
