import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import { Navigation } from './Navigation'

export default async function Layout({
  params,
  children,
}: {
  params: { organization: string }
  children: React.ReactNode
}) {
  const api = getServerSideAPI()
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
  )

  return (
    <div className="flex flex-col">
      <div className="dark:bg-polar-900 flex w-full flex-col bg-gray-50">
        <div className="mx-auto flex w-full max-w-5xl flex-col justify-center gap-y-12 px-4 py-12 lg:px-0">
          <div className="flex flex-row items-center gap-x-4">
            <Avatar
              className="h-10 w-10"
              avatar_url={organization.avatar_url}
              name={organization.name}
            />
            <h3 className="text-lg">{organization.name}</h3>
          </div>
          <div>
            <h2 className="text-4xl">Customer Portal</h2>
          </div>
        </div>
      </div>
      <div className="flex min-h-screen w-full flex-col items-stretch gap-6 px-4 py-8 md:mx-auto md:max-w-5xl md:flex-row md:gap-12 lg:px-0">
        <Navigation organization={organization} />
        <div className="flex w-full flex-col md:py-12">{children}</div>
      </div>
    </div>
  )
}
