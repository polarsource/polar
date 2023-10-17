import { useRouter } from 'next/navigation'
import { PrimaryButton } from 'polarkit/components/ui/atoms'
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
      <div className="dark:bg-polar-800 dark:ring-polar-700 flex flex-col items-start space-y-4 rounded-xl bg-white px-6 py-4 shadow dark:ring-1">
        <h2 className="dark:text-polar-50 text-center text-lg text-gray-900">
          Fund a Github issue
        </h2>
        <p className="dark:text-polar-400 flex-1 overflow-hidden text-sm text-gray-500">
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
            placeholder="URL to GitHub issue"
            className="dark:border-polar-600 dark:placeholder:text-polar-500 block w-full flex-1 rounded-lg border-gray-200 bg-transparent px-3 py-2.5 text-sm shadow-sm focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 dark:focus:border-blue-600 dark:focus:ring-blue-700/40"
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
