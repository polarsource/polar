'use client'

import Popover from '@/components/Notifications/Popover'
import GithubLoginButton from '@/components/Shared/GithubLoginButton'
import { ProfileMenu } from '@/components/Shared/ProfileSelection'
import { UserRead } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TopbarRight = ({
  authenticatedUser,
}: {
  authenticatedUser?: UserRead
}) => {
  const pathname = usePathname()
  const returnTo = pathname ?? '/feed'

  return (
    <>
      {authenticatedUser ? (
        <div className="flex flex-row items-center justify-between gap-x-6">
          <Popover type="topbar" />
          <ProfileMenu authenticatedUser={authenticatedUser} />
        </div>
      ) : (
        <>
          <GithubLoginButton
            text="Create with Polar"
            returnTo={returnTo}
            className="hidden md:flex"
          />

          <Link
            href={`/login?return_to=${returnTo}`}
            className="font-medium text-blue-500 hover:text-blue-600"
          >
            Login
          </Link>
        </>
      )}
    </>
  )
}

export default TopbarRight
