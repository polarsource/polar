'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import PublicProfileDropdown from '@/components/Navigation/PublicProfileDropdown'
import Popover from '@/components/Notifications/Popover'
import { UserRead } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TopbarRight = ({
  authenticatedUser,
}: {
  authenticatedUser?: UserRead
}) => {
  const pathname = usePathname()
  const loginReturnTo = pathname ?? '/feed'

  return (
    <>
      {authenticatedUser ? (
        <div>
          <div className="relative flex w-max flex-shrink-0 flex-row items-center justify-between gap-x-6">
            <Popover />
            <PublicProfileDropdown
              authenticatedUser={authenticatedUser}
              className="flex-shrink-0"
              showAllBackerRoutes
            />
          </div>
        </div>
      ) : (
        <>
          <GetStartedButton className="px-2 py-4 text-sm" />
          <Link
            href={`/login?return_to=${loginReturnTo}`}
            className="text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Login
          </Link>
        </>
      )}
    </>
  )
}

export default TopbarRight
