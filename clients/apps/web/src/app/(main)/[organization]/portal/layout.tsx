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
    <div className="dark:bg-polar-950 h-full bg-white dark:text-white">
      {children}
    </div>
  )
}
