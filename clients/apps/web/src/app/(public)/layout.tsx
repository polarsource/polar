'use client'

import BackerNavigation from '@/components/Dashboard/BackerNavigation'
import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import PublicLayout from '@/components/Layout/PublicLayout'
import TopbarRight from '@/components/Shared/TopbarRight'
import { useAuth, usePersonalOrganization } from '@/hooks'
import { ArrowForwardOutlined } from '@mui/icons-material'
import Link from 'next/link'
import { LogoIcon } from 'polarkit/components/brand'
import { Button } from 'polarkit/components/ui/atoms'
import { useListAdminOrganizations } from 'polarkit/hooks'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentUser, authenticated } = useAuth()
  const adminOrgs = useListAdminOrganizations()
  const personalOrg = usePersonalOrganization()

  const hasAdminOrgs = (adminOrgs.data?.items?.length ?? 0) > 0
  const hasPersonalOrg = !!personalOrg
  const shouldRenderCreateButton =
    authenticated && (hasAdminOrgs || hasPersonalOrg)
  const creatorPath = hasPersonalOrg
    ? `/maintainer/${currentUser?.username}/overview`
    : `/maintainer/${adminOrgs.data?.items?.[0]?.name}/overview`

  return (
    <Gatekeeper>
      <div className="flex flex-col gap-y-8">
        <div className="dark:border-b-polar-800 dark:bg-polar-950 sticky top-0 z-50 flex w-full flex-col items-center justify-start border-b border-b-gray-100 bg-white py-4">
          <div className="flex w-full max-w-7xl flex-row items-center justify-between">
            <div className="flex flex-row items-center gap-x-16">
              <Link href="/">
                <LogoIcon
                  className="text-blue-500 dark:text-blue-400"
                  size={42}
                />
              </Link>
              <div className="flex flex-row items-center gap-4">
                <BackerNavigation />
              </div>
            </div>
            <div className="flex flex-row items-center gap-x-4">
              {shouldRenderCreateButton && (
                <Link href={creatorPath}>
                  <Button>
                    <div className="flex flex-row items-center gap-x-2">
                      <span className="text-xs">Creator Dashboard</span>
                      <ArrowForwardOutlined fontSize="inherit" />
                    </div>
                  </Button>
                </Link>
              )}
              <TopbarRight authenticatedUser={currentUser} />
            </div>
          </div>
        </div>
        <PublicLayout showUpsellFooter={!authenticated} wide>
          <div className="relative flex min-h-screen w-full flex-col">
            {children}
          </div>
        </PublicLayout>
      </div>
    </Gatekeeper>
  )
}
