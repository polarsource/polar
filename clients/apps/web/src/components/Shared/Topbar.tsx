import { CubeIcon } from '@heroicons/react/24/outline'
import { classNames } from 'polarkit/utils'
import Popover from '../Notifications/Popover'
import Profile from './Profile'

const Topbar = (props: {
  children?: {
    left?: React.ReactNode
    center?: React.ReactNode
  }
  isFixed?: boolean
}) => {
  const className = classNames(
    props.isFixed ? 'fixed z-10' : '',
    'flex h-16 w-full items-center justify-between space-x-4 bg-white px-4 drop-shadow',
  )

  const hasLeft = !!props?.children?.left
  const hasMid = !!props?.children?.center

  return (
    <>
      <div className={className}>
        <div className="flex items-center space-x-4 md:flex-1">
          {hasLeft && props.children.left}
        </div>

        {hasMid && props.children.center}
        {!hasMid && (
          <>
            <div className="hidden flex-shrink-0 items-center space-x-2 font-semibold text-gray-700 md:inline-flex ">
              <CubeIcon className="h-6 w-6 " aria-hidden="true" />
              <span>Polar</span>
            </div>
          </>
        )}

        <div className="flex flex-shrink-0 justify-end space-x-4 md:flex-1">
          <Popover />
          <Profile />
        </div>
      </div>
    </>
  )
}
export default Topbar
