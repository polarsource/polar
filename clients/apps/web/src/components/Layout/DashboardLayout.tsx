import { classNames } from 'polarkit/utils'
import SidebarNavigation from '../Dashboard/SidebarNavigation'
import DashboardTopbar from '../Shared/DashboardTopbar'

const DashboardLayout = (props: {
  children: React.ReactElement
  header?: React.ReactElement
}) => {
  return (
    <div id="xx" className="relative flex flex-col">
      <DashboardTopbar />

      <div className="dark:bg-gray-950 flex flex-row bg-gray-50">
        <aside className="bg-gray-75 fixed top-16 bottom-0 left-0 w-80 flex-shrink-0 border-r border-r-gray-200 dark:border-r-gray-700 dark:bg-gray-800">
          <SidebarNavigation />
        </aside>
        <main className="relative ml-80 w-full">
          {props.header && (
            <div className="fixed top-16 left-80 right-0 z-10">
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
