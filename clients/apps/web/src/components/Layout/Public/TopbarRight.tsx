'use client'

import GithubLoginButton from '@/components/Auth/GithubLoginButton'
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
  const createWithPolarReturnTo = '/maintainer'

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
          <GithubLoginButton
            text="Create with Polar"
            returnTo={createWithPolarReturnTo}
            className="hidden bg-blue-500 text-white md:flex dark:bg-blue-500 dark:text-white"
          />

          {/* Login link needs to be on the default frontend (polar.sh) to handle custom domains. */}
          <Link
            href={`${process.env.NEXT_PUBLIC_FRONTEND_BASE_URL}/login?return_to=${loginReturnTo}`}
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
