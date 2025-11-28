import { Toaster } from '@/components/Toast/Toaster'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import { Navigation } from './Navigation'

export const dynamic = 'force-dynamic'

export default async function Layout(props: {
  params: Promise<{ organization: string }>
  children: React.ReactNode
}) {
  const params = await props.params

  const { children } = props

  const api = await getServerSideAPI()
  const { organization } = await getOrganizationOrNotFound(
    api,
    params.organization,
  )

  return (
    <div className="flex min-h-screen grow flex-col">
      <div className="flex w-full flex-col">
        <div className="flex flex-col justify-center gap-y-12 px-4 py-4 lg:px-8 lg:py-8">
          <Avatar
            className="h-8 w-8"
            avatar_url={organization.avatar_url}
            name={organization.name}
          />
        </div>
      </div>
      <div className="flex w-full flex-col items-stretch gap-6 px-4 py-8 md:mx-auto md:max-w-5xl md:flex-row md:gap-12 lg:px-0">
        <Navigation organization={organization} />
        <div className="flex w-full flex-col md:py-12">{children}</div>
      </div>
      <Toaster />
    </div>
  )
}
