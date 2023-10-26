import { PlusIcon } from '@heroicons/react/20/solid'
import Image from 'next/image'
import { CONFIG } from 'polarkit'
import { Button } from 'polarkit/components/ui/atoms'
import { useStore } from 'polarkit/store'
import { posthog } from 'posthog-js'
import { MouseEvent, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
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
        className={twMerge(
          'flex-start dark:bg-polar-800 dark:ring-polar-700 mb-4 flex flex-row overflow-hidden rounded-xl bg-white shadow dark:ring-1',
        )}
      >
        <div className="flex-1">
          <div className="flex h-full flex-col space-y-2 p-6 pt-4">
            <h2 className="text-xl">
              Connect a repo to unlock Polar’s full potential
            </h2>
            <div className="dark:text-polar-400 flex-1 text-sm text-gray-500">
              <p>
                Interested in getting backers behind your open source efforts?
                Connect your repositories to get started.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 pt-2 xl:justify-start">
              <Button
                color="blue"
                className="pl-3.5"
                fullWidth={false}
                onClick={() => {
                  posthog.capture(
                    'Connect Repository Clicked',
                    {
                      view: 'Onboarding Card Personal',
                    },
                    { send_instantly: true },
                  )
                  window.open(CONFIG.GITHUB_INSTALLATION_URL, '_blank')
                }}
              >
                <PlusIcon className="mr-2 h-6 w-6" />
                <span>Connect a repository</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={hideDashboardBanner}
              >
                Skip
              </Button>
            </div>
          </div>
        </div>
        <div className="relative hidden flex-1 xl:block">
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
