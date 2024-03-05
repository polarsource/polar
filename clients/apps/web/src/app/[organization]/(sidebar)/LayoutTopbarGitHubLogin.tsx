'use client'

import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import { UserSignupType } from '@polar-sh/sdk'
import { usePathname } from 'next/navigation'

const LayoutTopbarGitHubLogin = () => {
  const pathName = usePathname()
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

export default LayoutTopbarGitHubLogin
