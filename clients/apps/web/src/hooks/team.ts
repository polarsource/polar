import { Organization } from '@polar-sh/sdk'
import { useEffect, useState } from 'react'
import { useAuth } from './auth'

export const useListTeams = () => {
  const { currentUser, userOrganizations: allOrganizations } = useAuth()

  const [teams, setTeams] = useState<Organization[]>([])

  useEffect(() => {
    // Kind of a hack.
    // Filter out the users own organization if it exists.
    // This organiztaion can not have extra members, and can not be a "Team".
    const allTeams = allOrganizations.filter(
      (o) => o.slug !== currentUser?.email,
    )

    setTeams(allTeams)
  }, [allOrganizations, currentUser])

  return teams
}
