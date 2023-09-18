import { useRouter } from 'next/navigation'
import {
  IssueDashboardRead,
  IssueReferenceRead,
  IssueReferenceType,
  IssueStatus,
  Organization,
  Platforms,
  PledgeRead,
  PledgeState,
  PullRequestReference,
  Repository,
  State,
  Visibility,
} from 'polarkit/api/client'
import { IssueReadWithRelations } from 'polarkit/api/types'
import { PrimaryButton } from 'polarkit/components/ui'
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
    name: 'x',
    pledge_minimum_amount: 2000,
    pledge_badge_show_amount: true,
  }
  const demoRepo: Repository = {
    platform: Platforms.GITHUB,
    id: 'x',
    visibility: Visibility.PUBLIC,
    name: 'x',
    organization: demoOrg,
  }
  const demoIssue: IssueDashboardRead = {
    id: '',
    title: 'Provide a UserInfo endpoint implementation',
    reactions: {
      plus_one: 21,
    },
    comments: 17,
    progress: IssueStatus.PULL_REQUEST,
    platform: Platforms.GITHUB,
    organization_id: demoOrg.id,
    repository_id: demoRepo.id,
    number: 123,
    issue_created_at: 'x',
    state: State.OPEN,
    funding: {},
    pledge_badge_currently_embedded: false,
    needs_confirmation_solved: false,
  }

  const demoDependents: IssueReadWithRelations[] = [
    {
      ...demoIssue,
      title: 'Internal bug title',
      number: 102,

      organization: {
        ...demoOrg,
        name: 'corp',
      },
      repository: {
        ...demoRepo,
        name: 'api',
        visibility: Visibility.PUBLIC,
      },

      references: [],
      dependents: [],
      pledges: [],
    },
  ]

  const demoPledges: PledgeRead[] = [
    {
      id: 'x',
      created_at: 'y',
      issue_id: demoIssue.id,
      amount: 70000,
      repository_id: demoRepo.id,
      organization_id: demoOrg.id,
      state: PledgeState.PENDING,
    },
  ]

  const twoHoursAgo = new Date()
  twoHoursAgo.setHours(twoHoursAgo.getHours() - 2)

  const demoReferences: IssueReferenceRead[] = [
    {
      id: 'xx',
      type: IssueReferenceType.PULL_REQUEST,
      payload: {
        id: 'x',
        title: 'Add UserInfo endpoint',
        author_login: 'x',
        author_avatar: 'https://avatars.githubusercontent.com/u/1426460?v=4',
        number: 2341,
        additions: 318,
        deletions: 186,
        state: 'yyy',
        created_at: twoHoursAgo.toString(),
        is_draft: false,
      } as PullRequestReference,
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
            org={demoOrg}
            repo={demoRepo}
            issue={demoIssue}
            dependents={demoDependents}
            pledges={demoPledges}
            showIssueProgress={true}
            canAddRemovePolarLabel={false}
            references={demoReferences}
            showPledgeAction={false}
          />
          <div className="absolute -left-1 -right-1 -top-1 bottom-6 bg-gradient-to-b from-gray-50/10 to-gray-50 dark:from-gray-950/10 dark:to-gray-950"></div>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className=" flex flex-col items-center space-y-2  rounded-lg bg-white px-6 py-4 shadow dark:bg-gray-800 dark:ring-1 dark:ring-gray-700">
            <h2 className="text-center text-lg font-medium text-gray-900 dark:text-gray-400">
              Pledge to any Github issue
            </h2>
            <p className="flex-1 overflow-hidden text-center text-gray-500	">
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
                  <span>Pledge</span>
                </PrimaryButton>
              </div>
            </div>

            {errorMessage && (
              <p className="mt-2 text-sm text-red-500">{errorMessage}</p>
            )}
          </div>
          <div className="flex flex-col items-center space-y-2 rounded-lg bg-white px-6 py-4 shadow  dark:bg-gray-800 dark:ring-1 dark:ring-gray-700">
            <h2 className="text-center text-lg font-medium text-gray-900 dark:text-gray-400">
              Let Polar find issues automatically
            </h2>
            <p className="flex-1 text-center text-gray-500">
              Polar will search the repository for references to open source
              issues
            </p>
            <div>
              <PrimaryButton
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
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default OnboardingAddDependency
