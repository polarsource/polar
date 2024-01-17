import { UserRead } from '@polar-sh/sdk'
import { LogoIcon } from 'polarkit/components/brand'
import BackerNavigation from '../Dashboard/BackerNavigation'
import DashboardNavigation from '../Dashboard/DashboardNavigation'
import TopbarRight from './TopbarRight'

const Topbar = ({
  hideProfile,
  authenticatedUser,
}: {
  hideProfile?: boolean
  authenticatedUser?: UserRead
}) => {
  return (
    <>
      <div className="flex flex-row items-center gap-x-16">
        <LogoIcon className="text-blue-500 dark:text-blue-400" size={42} />
        <div className="dark:bg-polar-900 dark:ring-polar-800 flex flex-row items-center gap-4 rounded-full bg-white p-2 px-6 shadow-sm ring-1 ring-gray-100">
          <BackerNavigation />
          <DashboardNavigation />
        </div>
      </div>

      <div className="relative flex flex-shrink-0 items-center justify-end space-x-4 md:flex-1">
        {!hideProfile && <TopbarRight authenticatedUser={authenticatedUser} />}
      </div>
    </>
  )
}
export default Topbar
