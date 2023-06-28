import { classNames } from 'polarkit/utils'
import DashboardTopbar, {
  PersonalDashboardTopbar,
} from '../Shared/DashboardTopbar'

const DashboardLayout = (props: {
  children: any
  isPersonalDashboard: boolean
}) => {
  const { children, isPersonalDashboard } = props

  const bodyClasses = classNames(
    'flex min-h-screen flex-1 flex-col bg-gray-50 dark:bg-gray-950 pt-16 ',
  )

  return (
    <div className="">
      {isPersonalDashboard && <PersonalDashboardTopbar />}
      {!isPersonalDashboard && <DashboardTopbar />}
      <div>
        <div className={bodyClasses}>
          <main className="flex-1">
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
