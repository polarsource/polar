import { useStore } from 'polarkit/store'
import { classNames } from 'polarkit/utils'
import { useMemo } from 'react'
import BackerConnectUpsell from '../Dashboard/BackerConnectUpsell'
import Topbar from '../Shared/Topbar'

const BackerLayout = (props: {
  children: React.ReactNode
  disableOnboardingBanner?: boolean
}) => {
  const isBackerConnectUpsellSkiped = useStore(
    (store) => store.onboardingMaintainerConnectRepositoriesSkip,
  )

  const showBanner =
    !isBackerConnectUpsellSkiped && !props.disableOnboardingBanner

  const fixedHeight = useMemo(() => {
    return showBanner ? 37 : 0 // BackerConnectUpsell
  }, [showBanner])

  return (
    <div className="relative flex flex-col">
      <Topbar isFixed={true} useOrgFromURL={false} />

      <div className="flex flex-col bg-gray-50 pt-16 dark:bg-gray-950">
        <nav className="fixed z-10 w-full ">
          {showBanner && <BackerConnectUpsell />}
        </nav>

        <main className={classNames('relative w-full')}>
          <div
            className={classNames(
              'relative mx-auto max-w-screen-2xl px-4 pb-6 pt-4 md:px-16',
            )}
            style={{
              marginTop: `${fixedHeight}px`,
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
