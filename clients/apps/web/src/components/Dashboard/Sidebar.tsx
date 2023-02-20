import Profile from 'components/Shared/Profile'
import RepoSelection from './RepoSelection'

const Sidebar = () => {
  return (
    <>
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex min-h-0 flex-1 flex-col border-r border-gray-200 bg-white">
          <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            <div className="flex flex-shrink-0 items-center px-4">
              <RepoSelection />
            </div>
            <nav className="mt-5 flex-1 space-y-1 bg-white px-2"></nav>
          </div>
          <div className="flex flex-shrink-0 border-t border-gray-200 p-4">
            <Profile />
          </div>
        </div>
      </div>
    </>
  )
}
export default Sidebar
