import PublicLayout from '@/components/Layout/PublicLayout'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'

export default async function Layout({
  params,
  children,
}: {
  params: { organization: string }
  children: React.ReactNode
}) {
  const api = getServerSideAPI()
  await getOrganizationOrNotFound(api, params.organization)

  return (
    <PublicLayout
      className="dark:bg-polar-950 h-full bg-white dark:text-white"
      wide
      footer={false}
    >
      {children}
    </PublicLayout>
  )
}
