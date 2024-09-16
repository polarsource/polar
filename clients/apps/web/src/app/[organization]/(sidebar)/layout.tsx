import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import PublicLayout from '@/components/Layout/PublicLayout'
import PublicProfileDropdown from '@/components/Navigation/PublicProfileDropdown'
import { OrganizationPublicPageNav } from '@/components/Organization/OrganizationPublicPageNav'
import { PublicPageHeader } from '@/components/Profile/PublicPageHeader'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Organization, UserRead } from '@polar-sh/sdk'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import React from 'react'

export default async function Layout({
  params,
  children,
}: {
  params: { organization: string }
  children: React.ReactNode
}) {
  const api = getServerSideAPI()

  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  if (!organization.profile_settings?.enabled) {
    notFound()
  }

  let authenticatedUser: UserRead | undefined
  let userOrganizations: Organization[] = []

  try {
    authenticatedUser = await api.users.getAuthenticated()
    userOrganizations = (await api.organizations.list({ isMember: true })).items
  } catch (e) {}

  const hasOrgs = Boolean(userOrganizations && userOrganizations.length > 0)
  const isOrgAdmin = userOrganizations.some((org) => org.id === organization.id)
  const creatorPath = `/dashboard/${isOrgAdmin ? organization.slug : userOrganizations?.[0]?.slug}`

  return (
    <PublicLayout className="gap-y-0 py-6 md:py-12" wide>
      <div className="relative flex flex-row items-center justify-end gap-x-6">
        <BrandingMenu
          className="absolute left-1/2 -translate-x-1/2"
          size={50}
        />

        {authenticatedUser ? (
          <>
            {hasOrgs && (
              <Link className="hidden md:block" href={creatorPath}>
                <Button>
                  <div className="flex flex-row items-center gap-x-2">
                    <span className="whitespace-nowrap text-xs">Dashboard</span>
                  </div>
                </Button>
              </Link>
            )}
            <PublicProfileDropdown
              authenticatedUser={authenticatedUser}
              className="flex-shrink-0"
            />
          </>
        ) : (
          <Link href="/login">
            <Button>Login</Button>
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-grow flex-col items-center">
          <PublicPageHeader organization={organization} />
        </div>
        <div className="flex flex-col items-center">
          <OrganizationPublicPageNav organization={organization} />
        </div>
        <div className="flex h-full flex-grow flex-col gap-y-8 md:gap-y-16 md:py-12">
          {children}
        </div>
      </div>
    </PublicLayout>
  )
}
