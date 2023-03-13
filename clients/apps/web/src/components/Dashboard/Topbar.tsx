import {
  ArrowRightOnRectangleIcon,
  BellIcon,
  Cog8ToothIcon,
} from '@heroicons/react/24/outline'
import BalanceBadge from './BalanceBadge'

import RepoSelection from './RepoSelection'

const Topbar = () => {
  return (
    <div className="fixed z-10 flex h-16 w-full items-center justify-between bg-white px-4 drop-shadow">
      <div className="flex flex-1 items-center space-x-4 ">
        <RepoSelection />
        <BalanceBadge />
        <Cog8ToothIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
      </div>

      <div className=" font-semibold text-gray-700">Polar</div>

      <div className="flex flex-1 justify-end space-x-4">
        <BellIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
        <ArrowRightOnRectangleIcon
          className="h-6 w-6 text-gray-400"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
export default Topbar
