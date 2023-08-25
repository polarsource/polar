import { Repository } from 'polarkit/api/client'
import { classNames } from 'polarkit/utils'
import SidebarNavigation from '../Dashboard/MaintainerNavigation'
import MaintainerRepoSelection from '../Dashboard/MaintainerRepoSelection'
import Topbar from '../Shared/Topbar'

const DashboardLayout = (props: {
  children: React.ReactElement
  showSidebar: boolean
  header?: React.ReactElement
}) => {
  return (
    <div className="relative flex flex-col">
      <Topbar isFixed={true} />

      <div className="dark:bg-gray-950 flex flex-row bg-gray-50">
        {props.showSidebar && (
          <aside className="bg-gray-75 fixed top-16 bottom-0 left-0 w-[300px] flex-shrink-0 border-r border-r-gray-200 dark:border-r-gray-700 dark:bg-gray-800">
            <SidebarNavigation />
          </aside>
        )}
        <main
          className={classNames(
            props.showSidebar ? 'ml-[300px]' : '',
            'relative w-full',
          )}
        >
          {props.header && (
            <div
              className={classNames(
                props.showSidebar ? 'left-[300px]' : 'left-0',
                'sticky top-16 right-0 z-10',
              )}
            >
              {props.header}
            </div>
          )}
          <div
            className={classNames(
              'relative mx-auto max-w-screen-2xl px-4 pt-24 pb-6 sm:px-6 md:px-8',
            )}
          >
            {props.children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout

export const RepoPickerHeader = (props: {
  currentRepository?: Repository
  repositories: Repository[]
  children?: React.ReactElement
}) => {
  const onSubmit = () => {}

  return (
    <>
      <form
        className="flex flex-col justify-between space-y-2 border-b bg-gray-100/50 bg-white p-2 !pr-2 backdrop-blur-none dark:bg-gray-700/50 lg:flex-row lg:items-center lg:space-x-4 lg:space-y-0 lg:bg-transparent lg:p-0 lg:backdrop-blur"
        onSubmit={onSubmit}
      >
        <MaintainerRepoSelection
          current={props.currentRepository}
          repositories={props.repositories}
        />
        {props.children}
      </form>
    </>
  )
}
