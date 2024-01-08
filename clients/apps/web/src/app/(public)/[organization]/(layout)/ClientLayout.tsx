import Footer from '@/components/Organization/Footer'
import { OrganizationPublicPageNav } from '@/components/Organization/OrganizationPublicPageNav'
import { OrganizationPublicSidebar } from '@/components/Organization/OrganizationPublicSidebar'
import { Organization } from '@polar-sh/sdk'
import { LogoType } from 'polarkit/components/brand'
import { PropsWithChildren } from 'react'
import LayoutTopbarAuth from './LayoutTopbarAuth'

const ClientLayout = ({
  organization,
  children,
}: PropsWithChildren<{ organization: Organization }>) => {
  return (
    <div className="flex min-h-screen flex-col justify-between">
      <div className="flex flex-col">
        <div className="dark:bg-polar-900 sticky top-0 z-50 bg-white px-4 py-4 shadow-sm md:px-8">
          <div className="relative mx-auto flex w-full max-w-7xl flex-row items-center justify-between gap-x-24 md:justify-normal md:space-y-0 lg:px-0">
            <div className="shrink-0 md:w-64">
              <a href="/">
                <LogoType />
              </a>
            </div>
            <div className="flex flex-row items-center justify-between md:w-full">
              <OrganizationPublicPageNav
                className="hidden md:flex"
                organization={organization}
              />

              <LayoutTopbarAuth />
            </div>
          </div>
        </div>

        <div className="mx-auto mb-16 mt-4 flex w-full max-w-7xl flex-col space-y-8 px-4 lg:px-0">
          <div className="flex w-full flex-col gap-8 py-6 md:flex-row md:gap-24">
            <OrganizationPublicSidebar organization={organization} />
            <div className="-mx-4 flex flex-row overflow-x-auto px-4 pb-4 md:hidden">
              <OrganizationPublicPageNav
                className="flex-row"
                organization={organization}
              />
            </div>
            <div className="flex h-full w-full flex-col">{children}</div>
          </div>
        </div>
      </div>
      <Footer wide />
    </div>
  )
}

export default ClientLayout
