'use client'

import { useAuth } from '@/hooks'
import GithubLoginButton from './GithubLoginButton'
import { ProfileMenu } from './ProfileSelection'

const TopbarRight = () => {
  const { currentUser, hydrated } = useAuth()

  if (!hydrated) {
    return <></>
  }

  return (
    <>
      {currentUser && <ProfileMenu />}
      {!currentUser && <GithubLoginButton text="Continue with GitHub" />}
    </>
  )
}

export default TopbarRight
