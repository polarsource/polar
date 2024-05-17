import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import Footer from '@/components/Organization/Footer'
import { getServerSideAPI } from '@/utils/api/serverside'
import {
  ApiOutlined,
  DescriptionOutlined,
  SpaceDashboardOutlined,
} from '@mui/icons-material'
import { ListResourceOrganization, UserRead } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import { Separator } from 'polarkit/components/ui/separator'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import { PolarMenu } from '../[organization]/(sidebar)/LayoutPolarMenu'
import { Navigation } from './Navigation'
import { NaviagtionItem } from './NavigationItem'

export default async function Layout({ children }: PropsWithChildren) {
  return (
    <div className="flex w-full flex-col items-center gap-y-12">
      <div className="flex h-fit w-full max-w-[100vw] flex-row justify-stretch gap-x-12 px-8 py-12 md:max-w-[1560px] md:px-12">
        <div className="flex w-full flex-grow flex-col gap-y-12">
          <DocumentationPageTopbar />
          <Separator />
          <div className="flex flex-row items-start gap-x-16 pb-24">
            <div className="flex w-60 flex-shrink-0 flex-col gap-y-12">
              <ul className="flex flex-col">
                <li>
                  <NaviagtionItem
                    icon={<SpaceDashboardOutlined fontSize="inherit" />}
                    href="/docs/overview"
                  >
                    Overview
                  </NaviagtionItem>
                </li>
                <li>
                  <NaviagtionItem
                    icon={<ApiOutlined fontSize="inherit" />}
                    href="/docs/api"
                  >
                    API Reference
                  </NaviagtionItem>
                </li>
                <li>
                  <NaviagtionItem
                    icon={<DescriptionOutlined fontSize="inherit" />}
                    href="/docs/guides"
                  >
                    Guides
                  </NaviagtionItem>
                </li>
              </ul>
              <Separator />
              <Navigation />
            </div>
            <div className="flex h-full w-full flex-col">{children}</div>
          </div>
        </div>
      </div>
      <Footer showUpsellFooter={false} wide />
    </div>
  )
}

const DocumentationPageTopbar = async () => {
  const api = getServerSideAPI()
  let authenticatedUser: UserRead | undefined
  let userAdminOrganizations: ListResourceOrganization | undefined

  try {
    const [loadAuthenticatedUser, loadUserAdminOrganizations] =
      await Promise.all([
        api.users.getAuthenticated({ cache: 'no-store' }).catch(() => {
          // Handle unauthenticated
          return undefined
        }),
        // No caching, as we're expecting immediate updates to the response if the user converts to a maintainer
        api.organizations
          .list({ isAdminOnly: true }, { cache: 'no-store' })
          .catch(() => {
            // Handle unauthenticated
            return undefined
          }),
      ])
    authenticatedUser = loadAuthenticatedUser
    userAdminOrganizations = loadUserAdminOrganizations
  } catch (e) {
    notFound()
  }

  const centerClsx =
    'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'

  return (
    <div className="relative flex flex-row items-center justify-between bg-transparent">
      <h1 className="text-xl font-medium">Documentation</h1>

      <BrandingMenu
        className={twMerge('hidden md:block', centerClsx)}
        logoClassName="dark:text-white"
        size={50}
      />
      <BrandingMenu
        className={twMerge('md:hidden', centerClsx)}
        logoClassName="dark:text-white"
        size={50}
      />

      <div className="flex flex-row items-center gap-x-6">
        <PolarMenu
          authenticatedUser={authenticatedUser}
          userAdminOrganizations={userAdminOrganizations?.items ?? []}
        />
      </div>
    </div>
  )
}
