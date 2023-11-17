import { useListTeams } from '@/hooks'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Avatar } from 'polarkit/components/ui/atoms'
import { useListOrganizationMembers } from 'polarkit/hooks'
import { twMerge } from 'tailwind-merge'

const TeamsNavigation = () => {
  const allTeams = useListTeams()

  if (allTeams.length === 0) {
    return <></>
  }

  return (
    <div className="dark:border-polar-700 mx-4 space-y-2 border-t border-gray-100 pt-8 ">
      {allTeams.map((o) => (
        <Team org={o} key={o.id} />
      ))}
    </div>
  )
}

export default TeamsNavigation

const Team = ({ org }: { org: Organization }) => {
  const pathname = usePathname()
  const members = useListOrganizationMembers(org.id)
  const isActive = pathname.startsWith(`/team/${org.name.toLowerCase()}`)

  return (
    <Link
      className={twMerge(
        'flex w-full items-center gap-x-4 rounded-xl border border-transparent px-5 py-3 text-sm transition-colors',
        isActive
          ? 'dark:bg-polar-800 dark:border-polar-700 bg-blue-50 text-blue-500 dark:text-blue-400'
          : 'dark:text-polar-500 dark:hover:text-polar-200 text-gray-900 hover:text-blue-500',
      )}
      href={`/team/${org.name}/funding`}
    >
      <div className="flex w-full min-w-0 flex-1 items-center gap-4">
        <Avatar
          avatar_url={org.avatar_url}
          name={org.name}
          className="h-8 w-8"
        />
        <span className="shrink grow-0 truncate">{org.name}</span>
      </div>

      <div className="flex flex-shrink-0 items-center -space-x-2.5">
        {members.data?.items?.slice(0, 3).map((m) => (
          <Avatar
            avatar_url={m.avatar_url}
            name={m.name}
            key={m.github_username}
          />
        ))}
      </div>
    </Link>
  )
}
