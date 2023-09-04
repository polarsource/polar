import { PlusIcon } from '@heroicons/react/24/solid'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import { PrimaryButton } from 'polarkit/components/ui'
import { CONFIG } from 'polarkit/config'
import { posthog } from 'posthog-js'
import screenshot from './Screenshot.jpg'
import screenshotDark from './ScreenshotDark.jpg'

const OnboardingConnectReposToGetStarted = () => {
  const { resolvedTheme } = useTheme()

  return (
    <div className="flex flex-col items-center space-y-4 pt-24">
      <h2 className="text-2xl">Get funded</h2>
      <p className="max-w-3xl text-center text-gray-500 dark:text-gray-400">
        Interested in getting backers behind your open source efforts? Connect
        your repositories to get started.
      </p>
      <div className="py-2">
        <PrimaryButton
          color="lightblue"
          onClick={() => {
            posthog.capture(
              'Connect Repository Clicked',
              {
                view: 'Onboarding Card',
              },
              { send_instantly: true },
            )
            window.open(CONFIG.GITHUB_INSTALLATION_URL, '_blank')
          }}
        >
          <PlusIcon className="h-6 w-6" />
          <span>Connect a repository</span>
        </PrimaryButton>
      </div>
      <Image
        src={resolvedTheme === 'dark' ? screenshotDark : screenshot}
        priority={true}
        alt="Screenshot of the Polar dashboard with connected repositories"
      />
    </div>
  )
}

export default OnboardingConnectReposToGetStarted
