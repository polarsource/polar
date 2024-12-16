import PublicLayout from '@/components/Layout/PublicLayout'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import Avatar from 'polarkit/components/ui/atoms/avatar'

export default async function Layout({
  params,
  children,
}: {
  params: { organization: string }
  children: React.ReactNode
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationOrNotFound(api, params.organization)

  return (
    <div className="dark:bg-polar-950 h-full bg-gray-100 dark:text-white">
      <PublicLayout className="gap-y-0 py-6 md:py-12" wide footer={false}>
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-x-4">
            <Avatar
              className="h-12 w-12"
              avatar_url={organization.avatar_url}
              name={organization.name}
            />
            <h3 className="text-xl">{organization.name}</h3>
          </div>
          <h3 className="text-xl">Customer Portal</h3>
        </div>
        {children}
      </PublicLayout>
    </div>
  )
}
