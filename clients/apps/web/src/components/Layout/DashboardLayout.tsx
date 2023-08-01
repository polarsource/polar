import SidebarNavigation from '../Dashboard/SidebarNavigation'
import DashboardTopbar, {
  PersonalDashboardTopbar,
} from '../Shared/DashboardTopbar'

const DashboardLayout = (props: {
  children: any
  isPersonalDashboard: boolean
}) => {
  const { children, isPersonalDashboard } = props

  return (
    <div className="">
      {isPersonalDashboard && <PersonalDashboardTopbar />}
      {!isPersonalDashboard && <DashboardTopbar />}
      <div>
        <div className="dark:bg-gray-950 flex min-h-screen flex-1 flex-row bg-gray-50 pt-16">
          <aside className="bg-gray-75 t-0 b-0 fixed min-h-screen w-80 flex-shrink-0 border-r border-r-gray-200">
            <SidebarNavigation />
          </aside>
          <main className="flex-1 pl-80">
            <div className="py-6">
              <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 md:px-8">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default DashboardLayout
