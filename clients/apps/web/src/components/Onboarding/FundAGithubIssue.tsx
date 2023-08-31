import { useRouter } from 'next/navigation'
import { PrimaryButton } from 'polarkit/components/ui'
import { parseGitHubIssueLink } from 'polarkit/github'
import { ChangeEvent, MouseEvent, useState } from 'react'

const FundAGithubIssue = () => {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState('')
  const [link, setLink] = useState('')
  const [disabled, setDisabled] = useState(true)

  const onLinkChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setErrorMessage('')
    setLink(event.target.value)
    setDisabled(event.target.value !== '' ? false : true)
  }

  const pledgeToIssue = async (event: MouseEvent) => {
    event.preventDefault()

    const issue = parseGitHubIssueLink(link)

    if (!issue) {
      setErrorMessage('Invalid GitHub issue link')
      setDisabled(true)
      return
    }

    router.push(
      `https://polar.sh/${issue.owner}/${issue.repo}/issues/${issue.number}`,
    )
  }

  return (
    <>
      <div className="flex flex-col items-start space-y-2 rounded-lg bg-white px-6 py-4 shadow dark:bg-gray-800 dark:ring-1 dark:ring-gray-700">
        <h2 className="text-center text-lg font-medium text-gray-900 dark:text-gray-400">
          Fund a Github issue
        </h2>
        <p className="flex-1 overflow-hidden text-gray-500	">
          Enter an issue link, like https://github.com/
          <wbr />
          polarsource/
          <wbr />
          polar/
          <wbr />
          issues/123 or polarsource/polar#123.
        </p>

        <div className="flex w-full items-center space-x-2">
          <input
            type="text"
            id="link"
            onChange={onLinkChange}
            onBlur={onLinkChange}
            value={link}
            placeholder="URL to Github issue"
            className="block w-full flex-1 rounded-lg border-gray-200 bg-transparent px-3 py-2.5 text-sm shadow-sm focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 dark:border-gray-600 dark:focus:border-blue-600 dark:focus:ring-blue-700/40"
          />

          <div>
            <PrimaryButton onClick={pledgeToIssue} disabled={disabled}>
              <span>Continue</span>
            </PrimaryButton>
          </div>
        </div>

        {errorMessage && (
          <p className="mt-2 text-sm text-red-500">{errorMessage}</p>
        )}
      </div>
    </>
  )
}

export default FundAGithubIssue
