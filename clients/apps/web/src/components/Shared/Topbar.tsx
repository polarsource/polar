import Link from 'next/link'
import { LogoIcon, LogoType } from 'polarkit/components/brand'
import { classNames } from 'polarkit/utils'
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks'
import Popover from '../Notifications/Popover'
import Profile from './Profile'

const Topbar = (props: {
  children?: {
    left?: React.ReactNode
    center?: React.ReactNode
  }
  isFixed?: boolean
  customLogoTitle?: string
  hideProfile?: boolean
}) => {
  const className = classNames(
    props.isFixed ? 'fixed z-10' : '',
    'flex h-16 w-full items-center justify-between space-x-4 bg-white dark:bg-gray-800 px-4 drop-shadow dark:border-b dark:border-gray-700',
  )

  const hasLeft = !!props?.children?.left
  const hasMid = !!props?.children?.center
  const hideProfile = props?.hideProfile

  const { authenticated } = useAuth()

  // Support server side rendering and hydration.
  // First render is always as if the user was logged out
  const [showProfile, setShowProfile] = useState(false)
  useEffect(() => {
    setShowProfile(authenticated)
  }, [authenticated])

  return (
    <>
      <div className={className}>
        <div className="flex items-center space-x-4 md:flex-1">
          {hasLeft && props.children && props.children.left}
        </div>

        {props.customLogoTitle && (
          <div className="flex items-center space-x-1">
            <LogoIcon />
            <span className="font-display text-xl">Backoffice</span>
          </div>
        )}

        {hasMid && props.children && props.children.center}
        {!hasMid && !props.customLogoTitle && (
          <>
            <Link
              href="/"
              className="hidden flex-shrink-0 items-center space-x-2 font-semibold text-gray-700 md:inline-flex"
            >
              <LogoType />
            </Link>
          </>
        )}

        <div className="flex flex-shrink-0 justify-end space-x-4 md:flex-1">
          {showProfile && !hideProfile && (
            <>
              {authenticated && <Popover />}
              <Profile />
            </>
          )}
        </div>
      </div>
    </>
  )
}
export default Topbar
