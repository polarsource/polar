import { client } from 'polar-api'
import { useQuery } from '@tanstack/react-query'

export const useDemos = () => useQuery(['demo'], () => client.demo.getAll())

export const useUserOrganizations = (userId) =>
  useQuery(['user', 'organizations', userId], () =>
    client.userOrganizations.getUserOrganizations(),
  )
