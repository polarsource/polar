import { classNames } from 'polarkit/utils'
import SidebarNavigation from '../Dashboard/SidebarNavigation'
import Topbar from '../Shared/Topbar'

const DashboardLayout = (props: {
  children: React.ReactElement
  showSidebar: boolean
  header?: React.ReactElement
}) => {
  return (
    <div id="xx" className="relative flex flex-col">
      <Topbar />

      <div className="dark:bg-gray-950 flex flex-row bg-gray-50">
        {props.showSidebar && (
          <aside className="bg-gray-75 fixed top-16 bottom-0 left-0 w-80 flex-shrink-0 border-r border-r-gray-200 dark:border-r-gray-700 dark:bg-gray-800">
            <SidebarNavigation />
          </aside>
        )}
        <main
          className={classNames(
            props.showSidebar ? 'ml-80' : '',
            'relative w-full',
          )}
        >
          {props.header && (
            <div
              className={classNames(
                props.showSidebar ? 'left-80' : 'left-0',
                'fixed top-16 right-0 z-10',
              )}
            >
              {props.header}
            </div>
          )}
          <div
            className={classNames(
              props.header ? 'pt-36' : 'pt-24',
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
