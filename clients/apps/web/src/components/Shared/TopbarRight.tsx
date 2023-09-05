'use client'

import { useAuth } from '@/hooks'
import Popover from '../Notifications/Popover'
import GithubLoginButton from './GithubLoginButton'
import ProfileSelection from './ProfileSelection'

const TopbarRight = (props: { useOrgFromURL: boolean }) => {
  const { currentUser, hydrated } = useAuth()

  if (!hydrated) {
    return <></>
  }

  return (
    <>
      {currentUser && <Popover />}
      {currentUser && <ProfileSelection useOrgFromURL={props.useOrgFromURL} />}
      {!currentUser && <GithubLoginButton text="Continue with Github" />}
    </>
  )
}

export default TopbarRight
