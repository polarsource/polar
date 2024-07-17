import { useListMemberOrganizations } from '@/hooks/queries'
import { Organization } from '@polar-sh/sdk'
import { useEffect, useState } from 'react'
import { useAuth } from './auth'

export const useListTeams = () => {
  const { currentUser } = useAuth()
  const allOrganizations = useListMemberOrganizations()

  const [teams, setTeams] = useState<Organization[]>([])

  useEffect(() => {
    // Kind of a hack.
    // Filter out the users own organization if it exists.
    // This organiztaion can not have extra members, and can not be a "Team".
    const allTeams = (allOrganizations.data?.items || []).filter(
      (o) => o.slug !== currentUser?.username,
    )

    setTeams(allTeams)
  }, [allOrganizations.data, currentUser])

  return teams
}
