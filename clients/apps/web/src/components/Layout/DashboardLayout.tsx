import { DashboardFilters } from 'components/Dashboard/filters'
import { IssueListType } from 'polarkit/api/client'
import { classNames } from 'polarkit/utils'
import { Dispatch, SetStateAction } from 'react'
import Sidebar from '../Dashboard/Sidebar'
import DashboardTopbar, {
  PersonalDashboardTopbar,
} from '../Shared/DashboardTopbar'

const DashboardLayout = (props: {
  children: any
  filters?: DashboardFilters
  showSidebar: boolean
  isPersonalDashboard: boolean
  onSetFilters?: Dispatch<SetStateAction<DashboardFilters>>
}) => {
  const { filters, onSetFilters, children, showSidebar } = props

  const bodyClasses = classNames(
    'flex min-h-screen flex-1 flex-col bg-gray-50 pt-16 ',
    showSidebar ? 'md:pl-80' : '',
  )

  const showTabs = props.isPersonalDashboard
    ? [IssueListType.DEPENDENCIES]
    : [IssueListType.DEPENDENCIES, IssueListType.ISSUES]

  return (
    <div className="">
      {props.isPersonalDashboard && <PersonalDashboardTopbar />}
      {!props.isPersonalDashboard && <DashboardTopbar />}
      <div>
        {showSidebar && (
          <Sidebar
            filters={filters}
            onSetFilters={onSetFilters}
            showTabs={showTabs}
          />
        )}
        <div className={bodyClasses}>
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
