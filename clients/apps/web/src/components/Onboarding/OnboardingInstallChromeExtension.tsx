import { PlusIcon } from '@heroicons/react/20/solid'
import Image from 'next/image'
import { Button } from 'polarkit/components/ui/atoms'
import { useStore } from 'polarkit/store'
import { MouseEvent, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import screenshot from './Extension.jpg'

const OnboardingInstallChromeExtension = () => {
  const isSkipped = useStore(
    (store) => store.onboardingDashboardInstallChromeExtensionSkip,
  )
  const setIsSkipped = useStore(
    (store) => store.setOnboardingDashboardInstallChromeExtensionSkip,
  )

  const hideDashboardBanner = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setIsSkipped(true)
  }

  const onPrimary = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setIsSkipped(true)
    window.open(
      'https://chrome.google.com/webstore/detail/polar/flgggfbldmglpjmagkhlhiohnkcmgbhi',
      '_blank',
    )
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
          'flex-start dark:bg-polar-800 dark:ring-polar-700 flex flex-row overflow-hidden rounded-xl bg-white shadow dark:ring-1',
        )}
      >
        <div className="flex-1">
          <div className="flex h-full flex-col space-y-2 p-6 pt-4">
            <h2 className="text-xl">Enhance GitHub Issues</h2>
            <p className="dark:text-polar-400 flex-1 text-sm text-gray-500">
              You don&apos;t have to leave GitHub to use Polar. Our extension
              can enhance the GitHub Issues table with our additional insights,
              pledges and more in the future.
            </p>
            <div className="flex items-center justify-between gap-4 pt-2 lg:justify-start">
              <Button
                color="blue"
                fullWidth={false}
                onClick={onPrimary}
                classNames="pl-3.5"
              >
                <PlusIcon className="mr-2 h-6 w-6" />
                <span>Install Chrome Extension</span>
              </Button>
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
            alt="Polar extension screenshot"
            priority={true}
            className="absolute h-full w-full object-cover object-left-top"
          />
        </div>
      </div>
    </>
  )
}

export default OnboardingInstallChromeExtension
