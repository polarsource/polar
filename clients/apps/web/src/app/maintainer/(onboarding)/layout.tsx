import LogoIcon from '@/components/Brand/LogoIcon'
import { getServerSideAPI } from '@/utils/api/serverside'
import { ListResourceOrganization, UserRead } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const api = getServerSideAPI()
  let authenticatedUser: UserRead | undefined
  let userAdminOrganizations: ListResourceOrganization | undefined

  try {
    const [loadAuthenticatedUser, loadUserAdminOrganizations] =
      await Promise.all([
        api.users.getAuthenticated({ cache: 'no-store' }).catch(() => {
          // Handle unauthenticated
          return undefined
        }),
        // No caching, as we're expecting immediate updates to the response if the user converts to a maintainer
        api.organizations
          .list({ isAdminOnly: true }, { cache: 'no-store' })
          .catch(() => {
            // Handle unauthenticated
            return undefined
          }),
      ])
    authenticatedUser = loadAuthenticatedUser
    userAdminOrganizations = loadUserAdminOrganizations
  } catch (e) {
    notFound()
  }

  return (
    <div className="flex flex-col items-center px-4 py-12">
      <LogoIcon className="text-blue-500 dark:text-blue-400" size={50} />
      <div className="relative flex min-h-screen w-full flex-col items-center md:py-0">
        {children}
      </div>
    </div>
  )
}
