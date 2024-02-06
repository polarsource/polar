'use client'

import { UserSignupType } from '@polar-sh/sdk'
import { LogoType70 } from 'polarkit/components/brand'
import { Progress50 } from '../Issues/IssueProgress'
import FakePullRequest from '../Settings/FakePullRequest'
import GithubLoginButton from '../Shared/GithubLoginButton'

const MaintainerSignup = () => {
  const steps = [
    {
      num: 1,
      text: 'Sign in with GitHub',
    },

    {
      num: 2,
      text: 'Connect public repositories',
    },

    {
      num: 3,
      text: 'Add funding badge to issues',
    },
  ]

  return (
    <div className="dark:bg-polar-950 flex w-full grow items-center justify-center bg-gray-50 px-4 md:h-screen">
      <div className="my-16 flex flex-col items-center  md:my-0">
        <LogoType70 className="mb-16 h-10" />

        <div className="dark:bg-polar-800 dark:ring-polar-800 flex flex-col gap-8 overflow-hidden rounded-lg bg-white shadow  dark:ring-1 md:flex-row ">
          <div className="flex flex-col gap-8 p-8 md:max-w-[320px] ">
            <h1 className="text-4xl font-light">Get a funded backlog</h1>

            <div className="flex flex-1 flex-col gap-4">
              {steps.map((s) => (
                <div className="flex items-center gap-4" key={s.num}>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-600 font-semibold text-blue-500">
                    <span>{s.num}</span>
                  </div>
                  <div className="dark:text-polar-400 text-gray-600">
                    {s.text}
                  </div>
                </div>
              ))}
            </div>

            <GithubLoginButton
              size="large"
              returnTo="/maintainer"
              userSignupType={UserSignupType.MAINTAINER}
              posthogProps={{
                view: 'Maintainer Signup',
              }}
              text="Sign up with GitHub"
            />
          </div>

          <div className="overflow-hidden border-l border-l-[#C9DAF4]/60 bg-[#F2F5FC]  dark:border-blue-600/50 dark:bg-blue-500/20">
            <div className="grid grid-cols-2">
              <div className="flex flex-col space-y-2 border-b border-r border-[#C9DAF4]/60 p-4 dark:border-blue-600/50">
                <h2 className="font-medium text-blue-500 dark:text-blue-400">
                  Funding goals
                </h2>
                <div className="flex flex-1 flex-col justify-center">
                  <div className="flex overflow-hidden rounded-full">
                    <div
                      className="h-2 bg-blue-500"
                      style={{ width: '60%' }}
                    ></div>
                    <div className="h-2 flex-1 bg-[#D6E3F7] dark:bg-[#D6E3F7]/20"></div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-2 border-b border-[#C9DAF4]/60 p-4 dark:border-blue-600/50">
                <h2 className="font-medium text-blue-500 dark:text-blue-400">
                  Reward contributors
                </h2>
                <div className="flex flex-1 flex-col justify-center">
                  <div className="flex -space-x-2">
                    <img
                      className="h-6 w-6 rounded-full ring-2 ring-white"
                      src="https://avatars.githubusercontent.com/u/281715?v=4"
                    />
                    <img
                      className="h-6 w-6 rounded-full ring-2 ring-white"
                      src="https://avatars.githubusercontent.com/u/1426460?v=4"
                    />
                    <img
                      className="h-6 w-6 rounded-full ring-2 ring-white"
                      src="https://avatars.githubusercontent.com/u/47952?v=4"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-2 border-b border-r border-[#C9DAF4]/60 p-4 dark:border-blue-600/50">
                <h2 className="font-medium text-blue-500 dark:text-blue-400">
                  Better backlog
                </h2>
                <div className="flex flex-1 flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <Progress50 />
                    <span className="text-blue-400 dark:text-blue-400">
                      In progress
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-2 border-b border-[#C9DAF4]/60 p-4 dark:border-blue-600/50">
                <h2 className="font-medium text-blue-500 dark:text-blue-400">
                  Sponsorship 2.0
                </h2>
                <div className="flex flex-1 flex-col justify-center">
                  <span className="font-mono text-blue-400 dark:text-blue-400">
                    &#47;&#47; coming soon
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-grid-pattern dark:bg-grid-pattern-dark h-full w-full overflow-hidden">
              <div
                className="-mb-2 -mr-12 ml-8 mt-8"
                style={{ width: 'inherit' }}
              >
                <FakePullRequest
                  showAmount={false}
                  large={false}
                  classNames="border border-[#3D54AB]/20 shadow-up dark:bg-polar-800"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          By using Polar you agree to our{' '}
          <a
            className="dark:text-polar-300 text-gray-700"
            href="https://polar.sh/legal/terms"
          >
            Terms of Service
          </a>{' '}
          and understand our{' '}
          <a
            className="dark:text-polar-300 text-gray-700"
            href="https://polar.sh/legal/privacy"
          >
            Privacy Policy
          </a>
          .
        </div>
      </div>
    </div>
  )
}

export default MaintainerSignup
