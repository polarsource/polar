'use client'

import { useAuth } from '@/hooks'
import Popover from '../Notifications/Popover'
import GithubLoginButton from './GithubLoginButton'

const TopbarRight = (props: { useOrgFromURL: boolean }) => {
  const { currentUser, hydrated } = useAuth()

  if (!hydrated) {
    return <></>
  }

  return (
    <>
      {currentUser && <Popover />}
      {!currentUser && <GithubLoginButton text="Continue with GitHub" />}
    </>
  )
}

export default TopbarRight
