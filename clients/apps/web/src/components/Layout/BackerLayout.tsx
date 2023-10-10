import ProfileSelection from '@/components/Shared/ProfileSelection'
import { useAuth } from '@/hooks/auth'
import { LogoType } from 'polarkit/components/brand'
import { useStore } from 'polarkit/store'
import { classNames } from 'polarkit/utils'
import { Suspense } from 'react'
import BackerConnectUpsell from '../Dashboard/BackerConnectUpsell'
import SidebarNavigation from '../Dashboard/BackerNavigation'
import Popover from '../Notifications/Popover'
import DashboardTopbar from '../Shared/DashboardTopbar'

const BackerLayout = (props: {
  children: React.ReactNode
  disableOnboardingBanner?: boolean
}) => {
  const { currentUser, hydrated } = useAuth()
  const isBackerConnectUpsellSkiped = useStore(
    (store) => store.onboardingMaintainerConnectRepositoriesSkip,
  )

  const showBanner =
    !isBackerConnectUpsellSkiped && !props.disableOnboardingBanner

  if (!hydrated) {
    return <></>
  }

  return (
    <div className="relative flex w-full flex-row">
      <aside className="h-screen w-[320px] flex-shrink-0 border-r border-r-gray-100 bg-white dark:border-r-gray-800 dark:bg-gray-900">
        <div className="relative z-10 mt-8 flex translate-x-0 flex-row items-center justify-between space-x-2 pl-9 pr-7">
          <a
            href="/"
            className="flex-shrink-0 items-center font-semibold text-gray-700"
          >
            <LogoType />
          </a>

          <Suspense>{currentUser && <Popover type="dashboard" />}</Suspense>
        </div>
        <div className="mt-8 flex px-4 py-2">
          {currentUser && (
            <ProfileSelection
              useOrgFromURL={true}
              className="shadow-xl"
              narrow={false}
            />
          )}
        </div>
        <SidebarNavigation />
      </aside>

      <div className="relative flex h-screen w-full translate-x-0 flex-row bg-gray-50 dark:bg-gray-950">
        <DashboardTopbar isFixed={true} useOrgFromURL={false} />
        <nav className="fixed z-10 w-full ">
          {showBanner && <BackerConnectUpsell />}
        </nav>

        <main className={classNames('relative h-full w-full overflow-y-auto')}>
          <div
            className={classNames(
              'relative mx-auto max-w-screen-2xl px-4 sm:px-6 md:px-8',
            )}
            style={{
              marginTop: `107px`,
            }}
          >
            {props.children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default BackerLayout
