import { useMemo } from 'react'
import { useAuth } from './auth'

export const useListTeams = () => {
  const { currentUser, userOrganizations: allOrganizations } = useAuth()

  // Kind of a hack.
  // Filter out the users own organization if it exists.
  // This organiztaion can not have extra members, and can not be a "Team".
  const teams = useMemo(() => {
    const allTeams = allOrganizations.filter(
      (o) => o.slug !== currentUser?.email,
    )
    return allTeams
  }, [allOrganizations, currentUser])

  return teams
}
