'use client'

import Footer from '@/components/Organization/Footer'
import { OrganizationPublicPageNav } from '@/components/Organization/OrganizationPublicPageNav'
import { OrganizationPublicSidebar } from '@/components/Organization/OrganizationPublicSidebar'
import GithubLoginButton from '@/components/Shared/GithubLoginButton'
import { ProfileMenu } from '@/components/Shared/ProfileSelection'
import { useAuth } from '@/hooks'
import { Organization, UserSignupType } from '@polar-sh/sdk'
import { usePathname } from 'next/navigation'
import { LogoType } from 'polarkit/components/brand'
import { Tabs } from 'polarkit/components/ui/atoms'
import { PropsWithChildren, useMemo } from 'react'

const ClientLayout = ({
  organization,
  children,
}: PropsWithChildren<{ organization: Organization }>) => {
  const { currentUser } = useAuth()
  const pathname = usePathname()
  const currentTab = useMemo(() => {
    const tabs = ['overview', 'subscriptions', 'issues', 'repositories']

    const pathParts = pathname.split('/')

    if (pathParts.includes('posts')) {
      return 'overview'
    } else {
      return tabs.find((tab) => pathParts.includes(tab)) ?? 'overview'
    }
  }, [pathname])

  return (
    <Tabs
      className="flex min-h-screen flex-col justify-between"
      value={currentTab}
    >
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

              {currentUser ? (
                <ProfileMenu className="z-50" />
              ) : (
                <GithubLoginButton
                  userSignupType={UserSignupType.BACKER}
                  posthogProps={{
                    view: 'Maintainer Page',
                  }}
                  text="Sign in with GitHub"
                  returnTo={pathname || '/feed'}
                />
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto mb-16 mt-4 flex w-full max-w-7xl flex-col space-y-8 px-4 lg:px-0">
          <div className="flex w-full flex-col gap-8 py-6 md:flex-row md:gap-24">
            <OrganizationPublicSidebar organization={organization} />
            <OrganizationPublicPageNav
              className="flex flex-row md:hidden"
              organization={organization}
            />
            <div className="flex h-full w-full flex-col md:mt-0">
              {children}
            </div>
          </div>
        </div>
      </div>
      <Footer wide />
    </Tabs>
  )
}

export default ClientLayout
