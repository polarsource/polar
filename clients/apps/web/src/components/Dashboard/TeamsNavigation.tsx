import { useAuth } from '@/hooks'
import { isFeatureEnabled } from '@/utils/feature-flags'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { Avatar } from 'polarkit/components/ui/atoms'
import { useListAllOrganizations } from 'polarkit/hooks'

const TeamsNavigation = () => {
  const { currentUser, hydrated } = useAuth()

  const allOrganizations = useListAllOrganizations()

  // Kind of a hack.
  // Filter out the users own organization if it exists.
  // This organiztaion can not have extra members, and can not be a "Team".
  const allOrgs = (allOrganizations.data?.items || []).filter(
    (o) => o.name !== currentUser?.username,
  )

  const teamsEnabled = isFeatureEnabled('teams')

  if (!hydrated) {
    return <></>
  }

  if (!teamsEnabled) {
    return <></>
  }

  if (allOrgs.length === 0) {
    return <></>
  }

  return (
    <div className="dark:border-polar-700 mx-4 space-y-2 border-t border-gray-100 pt-8 ">
      {allOrgs.map((o) => (
        <Team org={o} key={o.id} />
      ))}
    </div>
  )
}

export default TeamsNavigation

const Team = ({ org }: { org: Organization }) => (
  <Link
    className="dark:bg-polar-700 dark:text-polar-300 dark:hover:bg-polar-800  flex items-center gap-4 rounded-xl bg-blue-50 px-4 py-2 text-sm text-gray-900 transition duration-100 hover:bg-blue-100"
    href={`/team/${org.name}`}
  >
    <Avatar avatar_url={org.avatar_url} name={org.name} className="h-8 w-8" />
    <span>{org.name}</span>
  </Link>
)
