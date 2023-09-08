import GithubLoginButton from '@/components/Shared/GithubLoginButton'
import {
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import Image from 'next/image'
import { Pledge } from 'polarkit/api/client'
import { WhiteCard } from 'polarkit/components/ui/Cards'
import screenshot from './dashboard.png'

const ThankYouUpsell = (props: { pledge: Pledge }) => {
  const { pledge } = props
  return (
    <>
      <WhiteCard
        className="mt-11 flex flex-row overflow-hidden"
        padding={false}
      >
        <div className="flex w-full flex-col space-y-4 p-5 md:w-2/5 md:p-6">
          <h2 className="text-xl">Sign up to Polar</h2>
          <GithubLoginButton
            text="Continue with Github"
            pledgeId={pledge.id}
            size="large"
            posthogProps={{
              view: 'Thank You Page',
            }}
          />

          <ul>
            <li className="flex flex-row items-center space-x-2">
              <CheckCircleIcon
                height={24}
                width={24}
                className="text-blue-500"
              />

              <div>
                <strong className="text-sm font-medium">
                  Track issue dependencies
                </strong>
                <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  Helicopter view vs. flooded inbox.
                </p>
              </div>
            </li>

            <li className="mt-3 flex flex-row items-center space-x-2">
              <CurrencyDollarIcon
                height={24}
                width={24}
                className="text-blue-500"
              />

              <div>
                <strong className="text-sm font-medium">
                  Pledge for progress
                </strong>
                <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  Upvote & back impactful efforts.
                </p>
              </div>
            </li>

            <li className="mb-2 mt-3 flex flex-row items-center space-x-2">
              <ClockIcon height={24} width={24} className="text-blue-500" />
              <div>
                <strong className="text-sm font-medium">Get unblocked</strong>
                <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  Don&apos;t fork around.
                </p>
              </div>
            </li>
          </ul>
        </div>
        <div className="bg-grid-pattern dark:bg-grid-pattern-dark relative hidden w-3/5 overflow-hidden border-l border-blue-100 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/20 md:block">
          <Image
            src={screenshot}
            alt="Polar dashboard screenshot"
            priority={true}
            className="absolute w-full"
          />
        </div>
      </WhiteCard>
    </>
  )
}

export default ThankYouUpsell
