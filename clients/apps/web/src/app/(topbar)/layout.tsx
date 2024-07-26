import Topbar from '@/components/Layout/Public/Topbar'
import PublicLayout from '@/components/Layout/PublicLayout'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getAuthenticatedUser } from '@/utils/user'
import { ListResourceOrganization } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const api = getServerSideAPI()
  const authenticatedUser = await getAuthenticatedUser(api)
  let userOrganizations: ListResourceOrganization | undefined

  try {
    const loadUserOrganizations = await api.organizations
      .list({ isMember: true }, { cache: 'no-store' })
      .catch(() => {
        // Handle unauthenticated
        return undefined
      })
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
