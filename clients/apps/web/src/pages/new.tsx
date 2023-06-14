import HowItWorks from '@/components/Pledge/HowItWorks'
import type { GetServerSideProps, NextPage } from 'next'
import { useRouter } from 'next/router'
import { PrimaryButton } from 'polarkit/components/ui'
import { WhiteCard } from 'polarkit/components/ui/Cards'
import { parseGitHubIssueLink } from 'polarkit/utils'
import { ChangeEvent, MouseEvent, useState } from 'react'

const NewPledgePage: NextPage = ({
  link: linkProp = '',
  errorMessage: errorMessageProp = '',
}: {
  link?: string
  errorMessage?: string
}) => {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState(errorMessageProp)
  const [link, setLink] = useState(linkProp)

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
            <div className="w-full py-5 px-3 text-left md:px-6">
              <form className="flex flex-col">
                <label
                  htmlFor="link"
                  className="mt-4 mb-2 text-sm font-medium text-gray-500 dark:text-gray-400"
                >
                  Paste link here
                  (https://github.com/polarsource/polar/issues/123,
                  polarsource/polar#123)
                </label>
                <input
                  type="text"
                  id="link"
                  onChange={onLinkChange}
                  onBlur={onLinkChange}
                  value={link}
                  className="block w-full rounded-lg border-gray-200 bg-transparent py-2.5 px-3 text-sm shadow-sm focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 dark:border-gray-600 dark:focus:border-blue-600 dark:focus:ring-blue-700/40"
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

export const getServerSideProps: GetServerSideProps = async (context) => {
  if (context.query.link && typeof context.query.link === 'string') {
    const issue = parseGitHubIssueLink(context.query.link)

    if (!issue) {
      return {
        props: {
          link: context.query.link,
          errorMessage: 'Invalid GitHub issue link',
        },
      }
    }

    return {
      redirect: {
        permanent: false,
        destination: `/${issue.owner}/${issue.repo}/issues/${issue.number}`,
      },
    }
  }

  return { props: {} }
}

export default NewPledgePage
