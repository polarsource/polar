import Topbar from '@/components/Layout/Public/Topbar'
import PublicLayout from '@/components/Layout/PublicLayout'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getAuthenticatedUser, getUserOrganizations } from '@/utils/user'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const api = getServerSideAPI()
  const authenticatedUser = await getAuthenticatedUser(api)
  const userOrganizations = await getUserOrganizations(api)

  return (
    <div className="flex flex-col md:gap-y-8">
      <Topbar
        authenticatedUser={authenticatedUser}
        userOrganizations={userOrganizations}
      />
      <PublicLayout showUpsellFooter={!authenticatedUser} wide>
        <div className="relative flex min-h-screen w-full flex-col py-4 md:py-0">
          {children}
        </div>
      </PublicLayout>
    </div>
  )
}
