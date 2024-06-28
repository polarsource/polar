import { DocumentationProvider } from '@/components/Documentation/DocumentationProvider'
import { fetchSchema } from '@/components/Documentation/openapi'
import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import Footer from '@/components/Organization/Footer'
import { getServerSideAPI } from '@/utils/api/serverside'
import { ListResourceOrganization, UserRead } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  DocumentationPageSidebar,
  MobileNav,
} from '../../components/Documentation/Navigation'
import { PolarMenu } from '../[organization]/(sidebar)/LayoutPolarMenu'

export default async function Layout({ children }: PropsWithChildren) {
  const openAPISchema = await fetchSchema()
  return (
    <DocumentationProvider>
      <div className="dark:bg-polar-950 flex w-full flex-col items-center gap-y-12 bg-white">
        <div className="flex h-fit w-full max-w-[100vw] flex-row justify-stretch">
          <div className="flex w-full flex-grow flex-col gap-y-12 pt-12 md:pt-0">
            <DocumentationPageTopbar />
            <MobileNav openAPISchema={openAPISchema} />
            <div className="flex flex-col gap-x-16 gap-y-16 px-4 pb-24 pt-16 md:flex-row md:items-start md:justify-between md:px-12 md:pt-0">
              <div className="hidden md:block">
                <DocumentationPageSidebar openAPISchema={openAPISchema} />
              </div>
              {children}
            </div>
          </div>
        </div>
        <Footer showUpsellFooter={false} wide />
      </div>
    </DocumentationProvider>
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
    <div className="dark:bg-polar-950 dark:border-polar-700 relative hidden flex-row items-center justify-between border-b border-gray-100 bg-white px-4 py-8 md:flex md:px-12">
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
