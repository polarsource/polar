import PublicLayout from '@/components/Layout/PublicLayout'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'
import Link from 'next/link'
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
    <div className="dark:bg-polar-950 h-full bg-white dark:text-white">
      <PublicLayout className="gap-y-0 py-6 md:py-12" wide footer={false}>
        <div className="flex flex-col items-center justify-between md:py-8">
          <Link
            href={`/${organization.slug}/portal`}
            className="flex flex-col items-center gap-y-4"
          >
            <Avatar
              className="h-16 w-16 text-lg md:text-5xl"
              avatar_url={organization.avatar_url}
              name={organization.name}
            />
            <h3 className="text-xl md:text-2xl">{organization.name}</h3>
          </Link>
        </div>
        {children}
      </PublicLayout>
    </div>
  )
}
