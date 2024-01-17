'use client'

import BackerNavigation from '@/components/Dashboard/BackerNavigation'
import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import PublicLayout from '@/components/Layout/PublicLayout'
import { useAuth } from '@/hooks'
import { AddOutlined } from '@mui/icons-material'
import Link from 'next/link'
import { LogoIcon } from 'polarkit/components/brand'
import { Avatar, Button } from 'polarkit/components/ui/atoms'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentUser, authenticated } = useAuth()

  return (
    <Gatekeeper>
      <PublicLayout showUpsellFooter={!authenticated} wide>
        <div className="sticky top-8 flex w-full flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-x-16">
            <LogoIcon className="text-blue-500 dark:text-blue-400" size={42} />
            <div className="dark:bg-polar-900 dark:ring-polar-800 flex flex-row items-center gap-4 rounded-full bg-white p-2 px-6 shadow-sm ring-1 ring-gray-100">
              <BackerNavigation />
            </div>
          </div>
          <div className="flex flex-row items-center gap-x-4">
            <Link href={`/maintainer/${currentUser?.username}/overview`}>
              <Button>
                <div className="flex flex-row items-center gap-x-2">
                  <AddOutlined fontSize="small" />
                  <span>Create</span>
                </div>
              </Button>
            </Link>
            <Avatar
              className="my-2 h-10 w-10"
              avatar_url={currentUser?.avatar_url}
              name={currentUser?.username ?? ''}
            />
          </div>
        </div>
        <div className="relative flex min-h-screen w-full flex-col">
          {children}
        </div>
      </PublicLayout>
    </Gatekeeper>
  )
}
