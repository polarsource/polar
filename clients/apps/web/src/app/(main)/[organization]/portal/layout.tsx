import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import { Separator } from '@polar-sh/ui/components/ui/separator'
import { Navigation } from './Navigation'

const links = [
  { href: '/', label: 'Overview' },
  { href: '/subscriptions', label: 'Subscriptions' },
  { href: '/usage', label: 'Usage' },
  { href: '/orders', label: 'Orders' },
]

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
      <div className="mx-auto flex w-full max-w-7xl flex-col justify-center gap-y-12 py-12">
        <div className="flex flex-row items-center gap-x-4">
          <Avatar
            className="h-12 w-12"
            avatar_url={organization.avatar_url}
            name={organization.name}
          />
          <h3 className="text-lg">{organization.name}</h3>
        </div>
        <div>
          <h2 className="text-4xl">Customer Portal</h2>
        </div>
      </div>
      <Separator />
      <div className="dark:divide-polar-700 mx-auto flex min-h-screen w-full max-w-7xl flex-row items-stretch divide-x">
        <Navigation organization={organization} />
        <div className="flex w-full max-w-7xl flex-col py-12 pl-12">
          {children}
        </div>
      </div>
    </div>
  )
}
