import { Platforms } from '@/../../../packages/polarkit/src/api/client'
import HowItWorks from '@/components/Pledge/HowItWorks'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { api } from 'polarkit/api'
import { PrimaryButton } from 'polarkit/components/ui'
import { WhiteCard } from 'polarkit/components/ui/Cards'
import { ChangeEvent, useState } from 'react'

type IssueInfo = {
  organization: string
  repository: string
  issue: number
}

const parseIssueURL = (url: string): IssueInfo | undefined => {
  const match = url.match(
    // TODO: other formats as well
    /^https?:\/\/github.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/,
  )
  if (!match) return undefined
  return {
    organization: match[1],
    repository: match[2],
    issue: Number.parseInt(match[3]),
  }
}

const NewPledgePage: NextPage = () => {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [url, setUrl] = useState('')

  const onUrlChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value)
  }

  const syncExternalIssue = async () => {
    setIsLoading(true)
    const issue = await api.issues.syncExternalIssue({
      platform: Platforms.GITHUB,
      requestBody: { url },
    })
    setIsLoading(false)
    router.push(`/${issue.owner}/${issue.repo}/issues/${issue.number}`)
  }

  return (
    <>
      <div className="mx-auto mt-12 w-full md:mt-24 md:w-[826px]">
        <h1 className="text-center text-3xl font-normal text-gray-800 dark:text-gray-300 md:text-4xl">
          Back an issue
        </h1>

        <div className="mt-8 flex flex-col md:mt-14">
          <WhiteCard
            className="flex flex-col items-stretch rounded-none p-2 text-center md:flex-row md:rounded-xl md:pr-0"
            padding={false}
          >
            <div className="py-5 px-3 text-left md:px-6">
              <form className="flex flex-col">
                <label
                  htmlFor="email"
                  className="mt-4 mb-2 text-sm font-medium text-gray-500 dark:text-gray-400"
                >
                  GitHub issue URL
                </label>
                <input
                  type="email"
                  id="url"
                  onChange={onUrlChange}
                  onBlur={onUrlChange}
                  value={url}
                  className="block w-full rounded-lg border-gray-200 bg-transparent py-2.5 px-3 text-sm shadow-sm focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 dark:border-gray-600 dark:focus:border-blue-600 dark:focus:ring-blue-700/40"
                />
              </form>
            </div>
            <div className="mt-6">
              <PrimaryButton
                disabled={false}
                loading={false}
                onClick={syncExternalIssue}
              >
                Pledge
              </PrimaryButton>
            </div>
          </WhiteCard>
        </div>

        <HowItWorks />
      </div>
    </>
  )
}

export default NewPledgePage
