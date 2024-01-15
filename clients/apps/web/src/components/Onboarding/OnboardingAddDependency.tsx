import {
  Issue,
  IssueReferenceRead,
  IssueReferenceType,
  IssueStateEnum,
  Organization,
  Platforms,
  Pledge,
  PledgeState,
  PledgeType,
  Repository,
  Visibility,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { Button, Input } from 'polarkit/components/ui/atoms'
import { CONFIG } from 'polarkit/config'
import { parseGitHubIssueLink } from 'polarkit/github'
import { posthog } from 'posthog-js'
import { ChangeEvent, MouseEvent, useState } from 'react'
import IssueListItem from '../Dashboard/IssueListItem'

const OnboardingAddDependency = () => {
  const demoOrg: Organization = {
    id: '',
    avatar_url: 'https://avatars.githubusercontent.com/u/110818415?s=200&v=4',
    platform: Platforms.GITHUB,
    name: 'demo',
    is_personal: false,
    has_app_installed: false,
    pledge_minimum_amount: 2000,
    pledge_badge_show_amount: true,
    is_teams_enabled: false,
  }
  const demoRepo: Repository = {
    platform: Platforms.GITHUB,
    id: 'x',
    visibility: Visibility.PUBLIC,
    name: 'repo',
    organization: demoOrg,
  }
  const demoIssue: Issue = {
    id: '',
    title: 'Provide a UserInfo endpoint implementation',
    reactions: {
      total_count: 21,
      plus_one: 21,
      minus_one: 0,
      laugh: 0,
      hooray: 0,
      confused: 0,
      heart: 0,
      rocket: 0,
      eyes: 0,
    },
    comments: 17,
    platform: Platforms.GITHUB,
    repository: demoRepo,
    number: 123,
    issue_created_at: new Date().toISOString(),
    state: IssueStateEnum.OPEN,
    funding: {},
    pledge_badge_currently_embedded: false,
    needs_confirmation_solved: false,
  }

  const demoPledges: Pledge[] = [
    {
      id: 'x',
      created_at: new Date().toISOString(),
      issue: demoIssue,
      amount: { currency: 'USD', amount: 70000 },
      state: PledgeState.PENDING,
      type: PledgeType.UPFRONT,
    },
  ]

  const twoHoursAgo = new Date()
  twoHoursAgo.setHours(twoHoursAgo.getHours() - 2)

  const demoReferences: IssueReferenceRead[] = [
    {
      id: 'xx',
      type: IssueReferenceType.PULL_REQUEST,
      pull_request_reference: {
        id: 'x',
        title: 'Add UserInfo endpoint',
        author_login: 'x',
        author_avatar: 'https://avatars.githubusercontent.com/u/1426460?v=4',
        number: 2341,
        additions: 318,
        deletions: 186,
        state: 'yyy',
        created_at: twoHoursAgo.toISOString(),
        is_draft: false,
      },
    },
  ]

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

    // If on polar.new, make sure to redirect user to polar.sh
    router.push(
      `https://polar.sh/${issue.owner}/${issue.repo}/issues/${issue.number}`,
    )
  }

  return (
    <>
      <div className="flex flex-col md:p-8 xl:p-16 ">
        <h2 className="text-center text-3xl">Sponsor issues you depend on</h2>

        <div className="relative mt-8 select-none">
          <IssueListItem
            issue={demoIssue}
            pledges={demoPledges}
            canAddRemovePolarLabel={false}
            references={demoReferences}
            showPledgeAction={false}
            showLogo={true}
          />
          <div className="absolute -left-1 -right-1 -top-1 bottom-6 bg-gradient-to-b from-gray-50/10 to-gray-50 dark:from-gray-950/10 dark:to-gray-950"></div>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className=" dark:bg-polar-800 dark:ring-polar-700 flex flex-col  items-center space-y-2 rounded-lg bg-white px-6 py-4 shadow dark:ring-1">
            <h2 className="dark:text-polar-200 text-center text-lg font-medium text-gray-900">
              Pledge to any GitHub issue
            </h2>
            <p className="dark:text-polar-400 flex-1 overflow-hidden text-center text-gray-500">
              Enter an issue link, like https://github.com/
              <wbr />
              polarsource/
              <wbr />
              polar/
              <wbr />
              issues/123 or polarsource/polar#123.
            </p>

            <div className="flex w-full items-center space-x-2">
              <Input
                type="text"
                id="link"
                onChange={onLinkChange}
                onBlur={onLinkChange}
                value={link}
                placeholder="URL to GitHub issue"
                className="block w-full flex-1"
              />

              <div>
                <Button onClick={pledgeToIssue} disabled={disabled}>
                  <span>Pledge</span>
                </Button>
              </div>
            </div>

            {errorMessage && (
              <p className="mt-2 text-sm text-red-500">{errorMessage}</p>
            )}
          </div>
          <div className="dark:bg-polar-800 dark:ring-polar-700 flex flex-col items-center space-y-2 rounded-lg bg-white px-6  py-4 shadow dark:ring-1">
            <h2 className="dark:text-polar-200 text-center text-lg font-medium text-gray-900">
              Let Polar find issues automatically
            </h2>
            <p className="dark:text-polar-400 flex-1 text-center text-gray-500">
              Polar will search the repository for references to open source
              issues
            </p>
            <div>
              <Button
                onClick={() => {
                  posthog.capture(
                    'Connect Repository Clicked',
                    {
                      view: 'New Signup',
                    },
                    { send_instantly: true },
                  )
                  window.open(CONFIG.GITHUB_INSTALLATION_URL, '_blank')
                }}
              >
                <span>Connect repository</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default OnboardingAddDependency
