import PublicLayout from '@/components/Layout/PublicLayout'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Link from 'next/link'

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
    <div className="dark:bg-polar-950 h-full bg-white dark:text-white">
      <PublicLayout className="gap-y-0 py-6 md:py-12" wide footer={false}>
        <div className="flex flex-row items-center gap-x-8">
          <Link
            href={`/${organization.slug}/portal`}
            className="flex flex-row items-center gap-x-4"
          >
            <Avatar
              className="h-12 w-12"
              avatar_url={organization.avatar_url}
              name={organization.name}
            />
            <h3 className="text-xl">{organization.name}</h3>
          </Link>
        </div>
        {children}
      </PublicLayout>
    </div>
  )
}
