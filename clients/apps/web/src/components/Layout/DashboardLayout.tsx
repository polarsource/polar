import { DashboardFilters } from 'dashboard/filters'
import { Dispatch, SetStateAction } from 'react'
import Sidebar from '../Dashboard/Sidebar'
import Topbar from '../Shared/Topbar'

const DashboardLayout = (props: {
  children: any
  filters: DashboardFilters
  onSetFilters: Dispatch<SetStateAction<DashboardFilters>>
}) => {
  const { filters, onSetFilters, children } = props
  return (
    <div className="">
      <Topbar isDashboard={true} />
      <div>
        <Sidebar filters={filters} onSetFilters={onSetFilters} />
        <div className="flex min-h-screen flex-1 flex-col bg-white pt-16 md:pl-80">
          <main className="flex-1">
            <div className="py-6">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
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
