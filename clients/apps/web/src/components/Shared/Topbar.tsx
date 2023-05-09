import Link from 'next/link'
import { classNames } from 'polarkit/utils'
import { useAuth } from '../../hooks'
import Popover from '../Notifications/Popover'
import LogoIcon from './LogoIcon'
import LogoType from './LogoType'
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
    'flex h-16 w-full items-center justify-between space-x-4 bg-white px-4 drop-shadow',
  )

  const hasLeft = !!props?.children?.left
  const hasMid = !!props?.children?.center
  const hideProfile = props?.hideProfile

  const { authenticated } = useAuth()

  return (
    <>
      <div className={className}>
        <div className="flex items-center space-x-4 md:flex-1">
          {hasLeft && props.children.left}
        </div>

        {props.customLogoTitle && (
          <div className="flex items-center space-x-1">
            <LogoIcon />
            <span className="font-display text-xl">Backoffice</span>
          </div>
        )}

        {hasMid && props.children.center}
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
          {!hideProfile && (
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
