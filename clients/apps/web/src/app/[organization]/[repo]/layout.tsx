import { PublicPageOrganizationContextProvider } from '@/providers/organization'
import { getServerSideAPI } from '@/utils/api'
import { Organization, Platforms, Repository, UserRead } from '@polar-sh/sdk'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LogoIcon } from 'polarkit/components/brand'
import { Avatar } from 'polarkit/components/ui/atoms'
import { organizationPageLink } from 'polarkit/utils/nav'
import React from 'react'
import { PolarMenu } from '../(sidebar)/LayoutPolarMenu'

const cacheConfig = {
  next: {
    revalidate: 30, // 30 seconds
  },
}

export default async function Layout({
  params,
  children,
}: {
  params: { organization: string; repo: string }
  children: React.ReactNode
}) {
  const api = getServerSideAPI()

  let authenticatedUser: UserRead | undefined
  let organization: Organization | undefined
  let repository: Repository | undefined
  let userAdminOrganizations: Organization[] | undefined

  try {
    const [
      loadAuthenticatedUser,
      loadOrganization,
      loadRepository,
      loadUserAdminOrganizations,
    ] = await Promise.all([
      api.users.getAuthenticated({ cache: 'no-store' }).catch(() => {
        // Handle unauthenticated
        return undefined
      }),
      api.organizations.lookup(
        {
          platform: Platforms.GITHUB,
          organizationName: params.organization,
        },
        cacheConfig,
      ),
      api.repositories.lookup(
        {
          platform: Platforms.GITHUB,
          organizationName: params.organization,
          repositoryName: params.repo,
        },
        cacheConfig,
      ),
      // No caching, as we're expecting immediate updates to the response if the user converts to a maintainer
      api.organizations
        .list({ isAdminOnly: true }, { cache: 'no-store' })
        .catch(() => {
          // Handle unauthenticated
          return undefined
        }),
    ])

    authenticatedUser = loadAuthenticatedUser
    organization = loadOrganization
    repository = loadRepository
    userAdminOrganizations = loadUserAdminOrganizations?.items ?? []
  } catch (e) {
    notFound()
  }

  if (!organization) {
    notFound()
  }

  return (
    <PublicPageOrganizationContextProvider organization={organization}>
      <div className="flex flex-col">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-y-8 px-4 md:h-full md:space-y-8 md:px-24">
          <div className="dark:bg-polar-950 sticky top-0 z-20 flex w-full flex-row items-center justify-between bg-white py-4 md:relative md:hidden">
            <a href="/">
              <LogoIcon
                className="text-blue-500 dark:text-blue-400"
                size={40}
              />
            </a>
            <PolarMenu
              organization={organization}
              authenticatedUser={authenticatedUser}
              userAdminOrganizations={userAdminOrganizations ?? []}
            />
          </div>
          <div className="jusitfy-between flex w-full flex-row items-center gap-x-10">
            <div className="flex w-full flex-row items-center gap-x-8">
              <LogoIcon
                className="hidden text-blue-500 dark:text-blue-400 md:block"
                size={40}
              />
              <Link className="-mr-4" href={organizationPageLink(organization)}>
                <Avatar
                  className="h-8 w-8"
                  avatar_url={organization.avatar_url}
                  name={organization.name}
                />
              </Link>
              <h1 className="flex flex-row items-baseline gap-x-4 text-2xl !font-normal">
                <Link
                  className="dark:text-polar-600 text-gray-400 transition-colors hover:text-blue-500 dark:hover:text-blue-400"
                  href={organizationPageLink(organization)}
                >
                  {repository.organization.name}
                </Link>
                <span className="dark:text-polar-600 text-gray-400">/</span>
                <Link
                  className="transition-colors hover:text-blue-500 dark:hover:text-blue-400"
                  href={organizationPageLink(organization, repository.name)}
                >
                  <span>{repository.name}</span>
                </Link>
              </h1>
              {/* <div className="flex flex-row rounded-full bg-gradient-to-r from-blue-300 to-blue-950 px-3 py-1.5 text-xs text-white">
                Staff Pick
              </div> */}
            </div>
            <div className="hidden flex-row items-center md:flex">
              <PolarMenu
                organization={organization}
                authenticatedUser={authenticatedUser}
                userAdminOrganizations={userAdminOrganizations}
              />
            </div>
          </div>
          {children}
        </div>
      </div>
    </PublicPageOrganizationContextProvider>
  )
}
