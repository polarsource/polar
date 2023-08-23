import { useStore } from 'polarkit/store'
import { classNames } from 'polarkit/utils'
import { useMemo } from 'react'
import BackerConnectUpsell from '../Dashboard/BackerConnectUpsell'
import BackerNavigation from '../Dashboard/BackerNavigation'
import Topbar from '../Shared/Topbar'

const BackerLayout = (props: {
  children: React.ReactElement
  disableOnboardingBanner?: boolean
}) => {
  const isBackerConnectUpsellSkiped = useStore(
    (store) => store.onboardingMaintainerConnectRepositoriesSkip,
  )

  const showBanner =
    !isBackerConnectUpsellSkiped && !props.disableOnboardingBanner

  const fixedHeight = useMemo(() => {
    return (
      46 + // BackerNavigation
      (showBanner ? 36 : 1) // BackerConnectUpsell
    )
  }, [isBackerConnectUpsellSkiped])

  return (
    <div className="relative flex flex-col">
      <Topbar isFixed={true} />

      <div className="dark:bg-gray-950 flex flex-col bg-gray-50 pt-16">
        <nav className="fixed z-10 w-full ">
          {showBanner && <BackerConnectUpsell />}
          <BackerNavigation classNames={showBanner ? 'border-y' : 'border-b'} />
        </nav>

        <main className={classNames('relative w-full')}>
          <div
            className={classNames(
              'relative mx-auto max-w-screen-2xl px-4 pt-4 pb-6 md:px-16',
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
