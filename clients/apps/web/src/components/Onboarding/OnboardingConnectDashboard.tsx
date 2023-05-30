import { PlusIcon } from '@heroicons/react/20/solid'
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
          <div className="flex h-full flex-col space-y-2 p-6 pt-4">
            <h2 className="text-xl text-gray-900">
              Connect a repo to unlock Polar’s full potential
            </h2>
            <div className="flex-1 text-sm text-gray-500">
              <p>
                <strong className="block font-medium text-gray-900">
                  Funded & improved backlog
                </strong>
                Public repositories can embed the Polar badge on their Github
                Issues.
              </p>
              <p className="mt-3">
                <strong className="block font-medium text-gray-900">
                  Track & back dependencies
                </strong>
                Helicopter view of all your internally referenced open source
                issues, their status and progress.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 pt-2 lg:justify-start">
              <PrimaryButton
                color="blue"
                classNames="pl-3.5"
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
                className="text-md text-blue-600 transition-colors duration-200 hover:text-blue-400"
                onClick={hideDashboardBanner}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
        <div className="relative hidden flex-1 lg:block">
          <Image
            src={screenshot}
            alt="Polar dashboard screenshot"
            priority={true}
            className="absolute h-full w-full object-cover object-left-top"
          />
        </div>
      </div>
    </>
  )
}

export default OnboardingConnectPersonalDashboard
