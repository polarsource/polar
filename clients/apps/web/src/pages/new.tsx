import HowItWorks from '@/components/Pledge/HowItWorks'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { api } from 'polarkit/api'
import { ApiError, Platforms } from 'polarkit/api/client'
import { PrimaryButton } from 'polarkit/components/ui'
import { WhiteCard } from 'polarkit/components/ui/Cards'
import { ChangeEvent, MouseEvent, useState } from 'react'

const NewPledgePage: NextPage = () => {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [url, setUrl] = useState('')

  const onUrlChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setErrorMessage('')
    setUrl(event.target.value)
  }

  const syncExternalIssue = async (event: MouseEvent) => {
    event.preventDefault()
    setIsLoading(true)
    try {
      const issue = await api.issues.syncExternalIssue({
        platform: Platforms.GITHUB,
        requestBody: { url },
      })
      setIsLoading(false)
      router.push(`/${issue.owner}/${issue.repo}/issues/${issue.number}`)
    } catch (e) {
      setIsLoading(false)
      if (e instanceof ApiError) {
        setErrorMessage(e.body.detail)
      }
    }
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
                  htmlFor="url"
                  className="mt-4 mb-2 text-sm font-medium text-gray-500 dark:text-gray-400"
                >
                  Paste link here
                  (https://github.com/polarsource/polar/issues/123,
                  polarsource/polar#123)
                </label>
                <input
                  type="text"
                  id="url"
                  onChange={onUrlChange}
                  onBlur={onUrlChange}
                  value={url}
                  className="block w-full rounded-lg border-gray-200 bg-transparent py-2.5 px-3 text-sm shadow-sm focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 dark:border-gray-600 dark:focus:border-blue-600 dark:focus:ring-blue-700/40"
                />

                <div className="mt-6">
                  <PrimaryButton
                    disabled={false}
                    loading={isLoading}
                    onClick={syncExternalIssue}
                  >
                    Pledge
                  </PrimaryButton>
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

export default NewPledgePage
