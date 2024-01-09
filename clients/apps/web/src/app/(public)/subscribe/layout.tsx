import PublicLayout from '@/components/Layout/PublicLayout'
import { getServerSideAPI } from '@/utils/api'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const api = getServerSideAPI()

  const [authenticatedUser] = await Promise.all([
    // Handle unauthenticated
    api.users.getAuthenticated({ cache: 'no-store' }).catch(() => {
      return undefined
    }),
  ])

  return (
    <PublicLayout showUpsellFooter={authenticatedUser === undefined}>
      <>{children}</>
    </PublicLayout>
  )
}
