import PublicLayout from '@/components/Layout/PublicLayout'
import Topbar from '@/components/Shared/Topbar'
import { getServerSideAPI } from '@/utils/api'
import { UserRead } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'

const cacheConfig = {
  next: {
    revalidate: 30, // 30 seconds
  },
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const api = getServerSideAPI()
  let authenticatedUser: UserRead | undefined

  try {
    const [loadAuthenticatedUser] = await Promise.all([
      // Handle unauthenticated
      api.users.getAuthenticated({ cache: 'no-store' }).catch(() => {
        return undefined
      }),
    ])
    authenticatedUser = loadAuthenticatedUser
  } catch (e) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-y-8">
      <Topbar authenticatedUser={authenticatedUser} />
      <PublicLayout showUpsellFooter={!authenticatedUser} wide>
        <div className="relative flex min-h-screen w-full flex-col">
          {children}
        </div>
      </PublicLayout>
    </div>
  )
}
