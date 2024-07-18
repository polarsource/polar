import Topbar from '@/components/Layout/Public/Topbar'
import PublicLayout from '@/components/Layout/PublicLayout'
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
  let userOrganizations: ListResourceOrganization | undefined

  try {
    const [loadAuthenticatedUser, loadUserOrganizations] = await Promise.all([
      api.users.getAuthenticated({ cache: 'no-store' }).catch(() => {
        // Handle unauthenticated
        return undefined
      }),
      // No caching, as we're expecting immediate updates to the response if the user converts to a maintainer
      api.organizations
        .list({ isMember: true }, { cache: 'no-store' })
        .catch(() => {
          // Handle unauthenticated
          return undefined
        }),
    ])
    authenticatedUser = loadAuthenticatedUser
    userOrganizations = loadUserOrganizations
  } catch (e) {
    notFound()
  }

  return (
    <div className="flex flex-col md:gap-y-8">
      <Topbar
        authenticatedUser={authenticatedUser}
        userOrganizations={userOrganizations?.items ?? []}
      />
      <PublicLayout showUpsellFooter={!authenticatedUser} wide>
        <div className="relative flex min-h-screen w-full flex-col py-4 md:py-0">
          {children}
        </div>
      </PublicLayout>
    </div>
  )
}
