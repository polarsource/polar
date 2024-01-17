'use client'

import BackerNavigation from '@/components/Dashboard/BackerNavigation'
import DashboardNavigation from '@/components/Dashboard/DashboardNavigation'
import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import PublicLayout from '@/components/Layout/PublicLayout'
import { useAuth } from '@/hooks'
import { LogoIcon } from 'polarkit/components/brand'
import { Avatar, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth()

  return (
    <Gatekeeper>
      <PublicLayout showUpsellFooter wide>
        <div className="relative flex w-full max-w-screen-xl flex-row items-start gap-x-12 py-6">
          <div className="sticky top-14 flex flex-col items-center gap-y-8">
            <div className="flex flex-col items-center">
              <LogoIcon
                className="text-blue-500 dark:text-blue-400"
                size={42}
              />
            </div>
            <div className="dark:bg-polar-900 dark:border-polar-800 flex flex-col gap-4 rounded-full bg-white p-3 shadow-sm dark:border">
              <div className="flex flex-col items-center gap-2">
                <BackerNavigation />
                <DashboardNavigation />
                <Avatar
                  className="my-2 h-8 w-8"
                  avatar_url={currentUser?.avatar_url}
                  name={currentUser?.username ?? ''}
                />
              </div>
            </div>
          </div>
          <ShadowBoxOnMd className="dark:bg-polar-900 bg-white">
            <div className="min-h-[100vh] w-full p-12">{children}</div>
          </ShadowBoxOnMd>
        </div>
      </PublicLayout>
    </Gatekeeper>
  )
}
