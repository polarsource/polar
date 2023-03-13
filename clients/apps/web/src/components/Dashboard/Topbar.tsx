import { BellIcon, Cog8ToothIcon, CubeIcon } from '@heroicons/react/24/outline'
import BalanceBadge from './BalanceBadge'
import Logout from './Logout'
import RepoSelection from './RepoSelection'

const Topbar = () => {
  return (
    <div className="fixed z-10 flex h-16 w-full items-center justify-between bg-white px-4 drop-shadow">
      <div className="flex flex-1 items-center space-x-4 ">
        <RepoSelection />
        <BalanceBadge />
        <Cog8ToothIcon
          className="h-6 w-6 cursor-pointer text-gray-400 transition-colors duration-100 hover:text-gray-800"
          aria-hidden="true"
        />
      </div>

      <div className=" inline-flex items-center space-x-2 font-semibold text-gray-700">
        <CubeIcon className="h-6 w-6 " aria-hidden="true" />
        <span>Polar</span>
      </div>

      <div className="flex flex-1 justify-end space-x-4">
        <BellIcon
          className="h-6 w-6 cursor-pointer text-gray-400 transition-colors duration-100 hover:text-gray-800"
          aria-hidden="true"
        />
        <Logout />
      </div>
    </div>
  )
}
export default Topbar
