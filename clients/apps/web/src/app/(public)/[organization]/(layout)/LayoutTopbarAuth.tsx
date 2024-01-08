'use client'

import GithubLoginButton from '@/components/Shared/GithubLoginButton'
import { ProfileMenu } from '@/components/Shared/ProfileSelection'
import { useAuth } from '@/hooks/auth'
import { UserSignupType } from '@polar-sh/sdk'
import { usePathname } from 'next/navigation'

const LayoutTopbarAuth = () => {
  const { currentUser } = useAuth()
  const pathName = usePathname()

  if (currentUser) {
    return <ProfileMenu className="z-50" />
  }

  return (
    <GithubLoginButton
      userSignupType={UserSignupType.BACKER}
      posthogProps={{
        view: 'Maintainer Page',
      }}
      text="Sign in with GitHub"
      returnTo={pathName || '/feed'}
    />
  )
}

export default LayoutTopbarAuth
