'use client'

import GithubLoginButton from '@/components/Shared/GithubLoginButton'
import { ProfileMenu } from '@/components/Shared/ProfileSelection'
import { UserRead } from '@polar-sh/sdk'
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
        <ProfileMenu authenticatedUser={authenticatedUser} />
      ) : (
        <GithubLoginButton text="Continue with GitHub" returnTo={returnTo} />
      )}
    </>
  )
}

export default TopbarRight
