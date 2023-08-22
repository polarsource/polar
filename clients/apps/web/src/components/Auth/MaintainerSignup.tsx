'use client'

import { LogoType70 } from 'polarkit/components/brand'
import { Progress50 } from '../Dashboard/IssueProgress'
import FakePullRequest from '../Settings/FakePullRequest'
import GithubLoginButton from '../Shared/GithubLoginButton'

const MaintainerSignup = () => {
  const steps = [
    {
      num: 1,
      text: 'Sign in with Github',
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
    <div className="dark:bg-gray-950 flex w-full grow items-center justify-center bg-[#FEFDF9] px-4 md:h-screen">
      <div className="my-16 flex flex-col items-center md:my-0">
        <LogoType70 className="mb-16 h-10" />

        <div className="flex flex-col gap-8 overflow-hidden rounded-lg bg-white shadow dark:bg-gray-900 dark:ring-1  dark:ring-gray-800 md:flex-row">
          <div className="flex flex-col gap-8 p-8 md:max-w-[320px]">
            <h1 className="text-4xl font-light">Get a funded backlog</h1>

            <div className="flex flex-1 flex-col gap-4">
              {steps.map((s) => (
                <div className="flex items-center gap-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-600 font-semibold text-blue-600">
                    <span>{s.num}</span>
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    {s.text}
                  </div>
                </div>
              ))}
            </div>

            <GithubLoginButton
              size="large"
              gotoUrl={'/maintainer'}
              posthogProps={{
                view: 'Maintainer Signup',
              }}
              text="Sign up with Github"
            />
          </div>

          <div className="overflow-hidden border-l border-l-[#C9DAF4]/60 bg-[#F2F5FC] ">
            <div className="grid grid-cols-2">
              <div className="flex flex-col space-y-2 border-b border-r border-[#C9DAF4]/60 p-4">
                <h2 className="font-medium text-blue-600">Funding goals</h2>
                <div className="flex flex-1 flex-col justify-center">
                  <div className="flex overflow-hidden rounded-full">
                    <div
                      className="h-2 bg-blue-500"
                      style={{ width: '60%' }}
                    ></div>
                    <div className="h-2 flex-1 bg-[#D6E3F7]"></div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-2 border-b border-[#C9DAF4]/60 p-4">
                <h2 className="font-medium text-blue-600">
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

              <div className="flex flex-col space-y-2 border-b border-r border-[#C9DAF4]/60 p-4">
                <h2 className="font-medium text-blue-600">Better backlog</h2>
                <div className="flex flex-1 flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <Progress50 />
                    <span className="text-blue-400">In progress</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-2 border-b border-[#C9DAF4]/60 p-4">
                <h2 className="font-medium text-blue-600">Funded milestones</h2>
                <div className="flex flex-1 flex-col justify-center">
                  <span className="font-mono text-blue-400">
                    &#47;&#47; coming soon
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-grid-pattern dark:grid-pattern-dark h-full w-full overflow-hidden">
              <div
                className="mt-8 ml-8 -mb-2 -mr-12"
                style={{ width: 'inherit' }}
              >
                <FakePullRequest
                  showAmount={false}
                  large={false}
                  classNames="border border-[#3D54AB]/20 shadow-up dark:bg-gray-800"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MaintainerSignup
