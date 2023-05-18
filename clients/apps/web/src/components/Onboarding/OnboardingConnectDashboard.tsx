import { PlusIcon } from '@heroicons/react/24/solid'
import Image from 'next/image'
import { CONFIG } from 'polarkit'
import { PrimaryButton } from 'polarkit/components/ui'
import { useStore } from 'polarkit/store'
import { classNames } from 'polarkit/utils'
import { MouseEvent, useEffect, useState } from 'react'
import screenshot from './ScreenshotDashboard.png'

const OnboardingConnectPersonalDashboard = () => {
  const isSkipped = useStore((store) => store.onboardingDashboardSkip)
  const setIsSkipped = useStore((store) => store.setOnboardingDashboardSkip)

  const hideDashboardBanner = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setIsSkipped(true)
  }

  const [show, setShow] = useState(false)

  useEffect(() => {
    setShow(!isSkipped)
  }, [isSkipped])

  if (!show) {
    return <></>
  }

  return (
    <>
      <div
        className={classNames(
          'flex-start mb-4 flex flex-row overflow-hidden rounded-lg bg-white shadow',
        )}
      >
        <div className="flex-1">
          <div className="flex h-full flex-col space-y-4 p-6">
            <h2 className="text-xl text-gray-900">
              Seamless & impactful funding
            </h2>
            <div className="flex-1 text-sm text-gray-500">
              <p>Connect a repository to unlock the full potential of Polar.</p>
              <p className="mt-4">
                <strong className="block font-medium text-gray-900">
                  Funded & improved backlog
                </strong>
                Public repositories can embed the Polar badge on their Github
                Issues.
              </p>
              <p className="mt-4">
                <strong className="block font-medium text-gray-900">
                  Track & back dependencies
                </strong>
                Helicopter view of all your internally referenced open source
                issues, their status and progress.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 lg:justify-start">
              <PrimaryButton
                color="blue"
                fullWidth={false}
                onClick={() => {
                  window.open(CONFIG.GITHUB_INSTALLATION_URL, '_blank')
                }}
              >
                <PlusIcon className="h-6 w-6" />
                <span>Connect a repository</span>
              </PrimaryButton>
              <button
                type="button"
                className="text-md text-blue-600"
                onClick={hideDashboardBanner}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
        <div className="hidden flex-1 lg:block">
          <Image
            src={screenshot}
            alt="Polar dashboard screenshot"
            priority={true}
            className="w-full"
          />
        </div>
      </div>
    </>
  )
}

export default OnboardingConnectPersonalDashboard
