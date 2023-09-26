'use client'

import { useRouter } from 'next/navigation'
import { PrimaryButton } from 'polarkit/components/ui'
import { WhiteCard } from 'polarkit/components/ui/Cards'
import { parseGitHubIssueLink } from 'polarkit/github'
import { ChangeEvent, MouseEvent, useState } from 'react'
import HowItWorks from './HowItWorks'

const PledgeByLink = ({
  initLinkValue,
  initErrorMessage,
}: {
  initLinkValue: string
  initErrorMessage: string
}) => {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState(initErrorMessage)
  const [link, setLink] = useState(initLinkValue)

  const onLinkChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setErrorMessage('')
    setLink(event.target.value)
  }

  const pledgeToIssue = async (event: MouseEvent) => {
    event.preventDefault()

    const issue = parseGitHubIssueLink(link)

    if (!issue) {
      setErrorMessage('Invalid GitHub issue link')
      return
    }

    // If on polar.new, make sure to redirect user to polar.sh
    router.push(
      `https://polar.sh/${issue.owner}/${issue.repo}/issues/${issue.number}`,
    )
  }

  return (
    <>
      <div className="mx-auto mt-12 w-full p-6 md:mt-24 md:w-[826px]">
        <h1 className="text-center text-3xl font-normal text-gray-800 dark:text-gray-300 md:text-4xl">
          Back an issue
        </h1>

        <div className="mb-12 mt-8 flex flex-col md:mt-14">
          <WhiteCard
            className="flex flex-col items-stretch rounded-none p-2 text-center md:flex-row md:rounded-xl md:pr-0"
            padding={false}
          >
            <div className="w-full px-3 py-5 text-left md:px-6">
              <form className="flex flex-col">
                <label
                  htmlFor="link"
                  className="text mb-2 mt-4 text-sm font-medium"
                >
                  GitHub issue link{' '}
                  <span className="font-normal text-gray-500	 dark:text-gray-400 ">
                    (e.g. https://github.com/
                    <wbr />
                    polarsource/
                    <wbr />
                    polar/
                    <wbr />
                    issues/
                    <wbr />
                    123, polarsource/polar#123)
                  </span>
                </label>

                <input
                  type="text"
                  id="link"
                  onChange={onLinkChange}
                  onBlur={onLinkChange}
                  value={link}
                  className="block w-full rounded-lg border-gray-200 bg-transparent px-3 py-2.5 text-sm shadow-sm focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 dark:border-gray-600 dark:focus:border-blue-600 dark:focus:ring-blue-700/40"
                />

                <div className="mt-6">
                  <PrimaryButton onClick={pledgeToIssue}>Pledge</PrimaryButton>
                </div>

                {errorMessage && (
                  <p className="mt-2 text-sm text-red-500">{errorMessage}</p>
                )}
              </form>
            </div>
          </WhiteCard>
        </div>

        <HowItWorks />
      </div>
    </>
  )
}

export default PledgeByLink
