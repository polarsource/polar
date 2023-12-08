'use client'

'use client'

import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import { Progress50 } from '@/components/Dashboard/IssueProgress'
import DashboardLayout from '@/components/Layout/DashboardLayout'
import FakePullRequest from '@/components/Settings/FakePullRequest'
import { useAuth } from '@/hooks'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CONFIG } from 'polarkit'
import { Button } from 'polarkit/components/ui/atoms'
import { useCallback, useEffect } from 'react'

export default function Page() {
  const { authenticated, hasChecked } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authenticated && hasChecked) {
      router.push(`/signup/maintainer`)
      return
    }
  }, [router, authenticated, hasChecked])

  const steps = [
    {
      num: 1,
      text: 'Connect public repositories',
    },
    {
      num: 2,
      text: 'Add funding badge to issues',
    },
    {
      num: 3,
      text: 'Setup payout account to receive the funds',
    },
  ]

  const handleConnectGithub = useCallback(() => {
    router.push(CONFIG.GITHUB_INSTALLATION_URL)
  }, [router])

  return (
    <Gatekeeper>
      <DashboardLayout>
        <div
          className={
            'relative mx-auto h-full max-w-screen-xl px-4 py-12 sm:px-6 md:px-8 md:py-6'
          }
        >
          <div className="flex h-full flex-col items-center justify-center md:my-0">
            <div className="dark:bg-polar-800 dark:ring-polar-800 flex flex-col gap-8 overflow-hidden rounded-lg bg-white shadow  dark:ring-1 md:flex-row ">
              <div className="flex flex-col gap-8 p-8 md:max-w-[320px] ">
                <h1 className="text-3xl">Polar for Organizations</h1>

                <div className="flex flex-1 flex-col gap-4">
                  {steps.map((s) => (
                    <div className="flex items-start gap-4">
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-blue-600 font-semibold text-blue-500">
                        <span>{s.num}</span>
                      </div>
                      <div className="dark:text-polar-400 text-gray-600">
                        {s.text}
                      </div>
                    </div>
                  ))}
                </div>
                <Link href={CONFIG.GITHUB_INSTALLATION_URL}>
                  <Button onClick={handleConnectGithub} fullWidth>
                    Add GitHub Organization
                  </Button>
                </Link>
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
          </div>
        </div>
      </DashboardLayout>
    </Gatekeeper>
  )
}

/**
TODO: Enable this once we have an api to activate teams funding


export default function Page() {
  const { authenticated, hasChecked } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authenticated && hasChecked) {
      router.push(`/signup/maintainer`)
      return
    }
  }, [router, authenticated, hasChecked])

  return (
    <Gatekeeper>
      <DashboardLayout>
        <div
          className={
            'relative mx-auto flex h-full max-w-screen-xl flex-col items-center px-4 py-16 sm:px-6 md:px-8 md:py-6'
          }
        >
          <div className="flex h-full w-fit flex-col items-center justify-center gap-y-16 md:my-0">
            <div className="flex max-w-lg flex-col items-center gap-y-8">
              <LogoIcon className="h-16 w-16 text-blue-500" />
              <h3 className="dark:text-polar-50 text-3xl text-gray-950">
                Polar for Organizations
              </h3>
              <p className="dark:text-polar-500 text-center leading-relaxed text-gray-500">
                Setup funding for your projects, or give members the ability to
                fund projects on behalf of your organization
              </p>
            </div>

            <div className="flex flex-col gap-8 md:flex-row">
              <GetFundingAsAnOrganization />
              <FundAsAnOrganization />
            </div>
          </div>
        </div>
      </DashboardLayout>
    </Gatekeeper>
  )
}

const GetFundingAsAnOrganization = () => {
  const router = useRouter()

  const handleConnectGithub = useCallback(() => {
    router.push(CONFIG.GITHUB_INSTALLATION_URL)
  }, [router])

  const steps = [
    {
      num: 1,
      text: 'Connect a GitHub Organization',
    },
    {
      num: 2,
      text: 'Add funding badge to issues',
    },
    {
      num: 3,
      text: 'Setup payout account to receive the funds',
    },
  ]
  return (
    <div className="dark:bg-polar-800 dark:ring-polar-800 flex flex-col gap-10 rounded-3xl bg-white p-8 shadow dark:ring-1 md:max-w-[320px]">
      <div className="flex flex-col gap-y-6">
        <AttachMoneyOutlined
          className="text-blue-500 dark:text-blue-400"
          fontSize="large"
        />

        <h1 className="text-2xl font-light leading-snug">
          Get funding for your projects
        </h1>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        {steps.map((s) => (
          <div className="flex items-start gap-4">
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-blue-600 font-semibold text-blue-500">
              <span>{s.num}</span>
            </div>
            <div className="dark:text-polar-400 text-gray-600">{s.text}</div>
          </div>
        ))}
      </div>
      <Link href={CONFIG.GITHUB_INSTALLATION_URL}>
        <Button onClick={handleConnectGithub} fullWidth>
          Get Started
        </Button>
      </Link>
    </div>
  )
}

const FundAsAnOrganization = () => {
  const router = useRouter()

  const handleConnectGithub = useCallback(() => {
    router.push(CONFIG.GITHUB_INSTALLATION_URL)
  }, [router])

  const steps = [
    {
      num: 1,
      text: 'Connect a GitHub Organization',
    },
    {
      num: 2,
      text: 'Setup a funding allowance for your members',
    },
    {
      num: 3,
      text: 'Get a monthly invoice to pay for the funds',
    },
  ]
  return (
    <div className="dark:bg-polar-800 dark:ring-polar-800 flex flex-col gap-10 rounded-3xl bg-white p-8 shadow dark:ring-1 md:max-w-[320px]">
      <div className="flex flex-col gap-y-6">
        <FavoriteBorderOutlined
          className="text-blue-500 dark:text-blue-400"
          fontSize="large"
        />

        <h1 className="text-2xl font-light leading-snug">
          Fund projects as a team
        </h1>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        {steps.map((s) => (
          <div className="flex items-start gap-4">
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-blue-600 font-semibold text-blue-500">
              <span>{s.num}</span>
            </div>
            <div className="dark:text-polar-400 text-gray-600">{s.text}</div>
          </div>
        ))}
      </div>
      <Link href={CONFIG.GITHUB_INSTALLATION_URL}>
        <Button onClick={handleConnectGithub} fullWidth>
          Get Started
        </Button>
      </Link>
    </div>
  )
}



*/
