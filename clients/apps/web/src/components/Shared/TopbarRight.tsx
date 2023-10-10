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
      {currentUser && (
        <div className="flex w-[280px] flex-row">
          <ProfileSelection
            showBackerLinks
            useOrgFromURL={props.useOrgFromURL}
            className="border border-gray-100 dark:border-gray-700"
          />
        </div>
      )}
      {!currentUser && <GithubLoginButton text="Continue with GitHub" />}
    </>
  )
}

export default TopbarRight
