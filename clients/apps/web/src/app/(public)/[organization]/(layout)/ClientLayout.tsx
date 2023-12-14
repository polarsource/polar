'use client'

import { OrganizationPublicPageNav } from '@/components/Organization/OrganizationPublicPageNav'
import { OrganizationPublicSidebar } from '@/components/Organization/OrganizationPublicSidebar'
import { Organization } from '@polar-sh/sdk'
import { LogoType } from 'polarkit/components/brand'
import { Tabs } from 'polarkit/components/ui/atoms'
import { PropsWithChildren } from 'react'

const ClientLayout = ({
  organization,
  children,
}: PropsWithChildren<{ organization: Organization }>) => {
  return (
    <Tabs className="flex min-h-screen flex-col justify-between">
      <div className="flex flex-col px-4 md:px-8">
        <div className="relative flex w-full flex-row items-center justify-between gap-x-24 md:justify-normal">
          <div className="shrink-0 md:w-64">
            <a href="/">
              <LogoType />
            </a>
          </div>
          <OrganizationPublicPageNav organization={organization} />
        </div>
        <div className="relative flex w-full flex-col gap-x-24 py-16 md:flex-row">
          <OrganizationPublicSidebar organization={organization} />
          <div className="mt-12 flex h-full w-full flex-col md:mt-0">
            {children}
          </div>
        </div>
      </div>
    </Tabs>
  )
}

export default ClientLayout
