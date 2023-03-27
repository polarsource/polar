import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { ArrowLeftIcon } from '@heroicons/react/24/solid'
import RepoSelection from 'components/Dashboard/RepoSelection'
import FakePullRequest from 'components/Settings/FakePullRequest'
import Topbar from 'components/Shared/Topbar'
import { NextPage } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  useOrganization,
  useOrganizationSettingsMutation,
} from 'polarkit/hooks'
import { ReactElement, useEffect, useRef, useState } from 'react'

const SettingsPage: NextPage = () => {
  const router = useRouter()
  const { organization } = router.query
  const handle: string = typeof organization === 'string' ? organization : ''
  const orgData = useOrganization(handle)
  const org = orgData.data

  const [badgeShowRaised, setBadgeShowRaised] = useState(false)
  const [badgeAddOldIssues, setBadgeAddOldIssues] = useState(false)

  const [emailIssueReceivesBacking, setEmailIssueReceivesBacking] =
    useState(false)
  const [emailIssueBranchCreated, setEmailIssueBranchCreated] = useState(false)
  const [emailPullRequestCreated, setEmailPullRequestCreated] = useState(false)
  const [emailPullRequestMerged, setEmailPullRequestMerged] = useState(false)

  const didFirstSet = useRef(false)

  useEffect(() => {
    if (!org) {
      return
    }

    if (didFirstSet.current) {
      return
    }

    setBadgeAddOldIssues(!!org.funding_badge_retroactive)
    setBadgeShowRaised(!!org.funding_badge_show_amount)

    setEmailIssueReceivesBacking(
      !!org.email_notification_issue_receives_backing,
    )
    setEmailIssueBranchCreated(
      !!org.email_notification_backed_issue_branch_created,
    )
    setEmailPullRequestCreated(
      !!org.email_notification_backed_issue_pull_request_created,
    )
    setEmailPullRequestMerged(
      !!org.email_notification_backed_issue_pull_request_merged,
    )

    didFirstSet.current = true
  }, [org])

  const mutation = useOrganizationSettingsMutation()

  const [userChanged, setUserChanged] = useState(false)
  const [showDidSave, setShowDidSave] = useState(false)

  const didSaveTimeout = useRef<undefined | ReturnType<typeof setTimeout>>(
    undefined,
  )

  const save = async () => {
    if (!userChanged) {
      return
    }

    mutation.mutate({
      orgName: handle,
      body: {
        funding_badge_show_amount: badgeShowRaised,
        funding_badge_retroactive: badgeAddOldIssues,

        email_notification_issue_receives_backing: emailIssueReceivesBacking,
        email_notification_backed_issue_branch_created: emailIssueBranchCreated,
        email_notification_backed_issue_pull_request_created:
          emailPullRequestCreated,
        email_notification_backed_issue_pull_request_merged:
          emailPullRequestMerged,
      },
    })

    setShowDidSave(true)

    if (didSaveTimeout.current) {
      clearTimeout(didSaveTimeout.current)
      didSaveTimeout.current = undefined
    }

    didSaveTimeout.current = setTimeout(() => {
      setShowDidSave(false)
    }, 2000)
  }

  useEffect(() => {
    save()
  }, [
    badgeShowRaised,
    badgeAddOldIssues,
    emailIssueReceivesBacking,
    emailIssueBranchCreated,
    emailPullRequestCreated,
    emailPullRequestMerged,
  ])

  return (
    <>
      <div className="mx-auto mt-24 max-w-[1100px]">
        <div className="pl-80">
          {showDidSave && <div className="h-4 text-black/50">Saved!</div>}
          {!showDidSave && <div className="h-4"></div>}
        </div>
        <div className="divide-y divide-gray-200">
          <Section>
            <SectionDescription
              title="Polar badge"
              description="Polar will inject this badge into new issues on Github."
            />

            <Box>
              <FakePullRequest showAmount={badgeShowRaised} />
              <Checkbox
                id="add-old-issues"
                title="Add badge to old issues as well"
                description="Could impact sorting on GitHub"
                isChecked={badgeAddOldIssues}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setBadgeAddOldIssues(e.target.checked)
                  setUserChanged(true)
                }}
              />
              <Checkbox
                id="show-raised"
                title="Show amount raised"
                isChecked={badgeShowRaised}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setBadgeShowRaised(e.target.checked)
                  setUserChanged(true)
                }}
              />
            </Box>
          </Section>
          <Section>
            <SectionDescription
              title="Email notifications"
              description="Polar will send emails for the notifications enabled below."
            />

            <Box>
              <Checkbox
                id="email-backing"
                title="Issue receives backing"
                isChecked={emailIssueReceivesBacking}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEmailIssueReceivesBacking(e.target.checked)
                  setUserChanged(true)
                }}
              />
              <Checkbox
                id="email-branch-created"
                title="Branch created for issue with backing"
                isChecked={emailIssueBranchCreated}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEmailIssueBranchCreated(e.target.checked)
                  setUserChanged(true)
                }}
              />
              <Checkbox
                id="email-pr-created"
                title="Pull request created for issue with backing"
                isChecked={emailPullRequestCreated}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEmailPullRequestCreated(e.target.checked)
                  setUserChanged(true)
                }}
              />
              <Checkbox
                id="email-pr-merged"
                title="Pull request merged for issue with backing"
                isChecked={emailPullRequestMerged}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEmailPullRequestMerged(e.target.checked)
                  setUserChanged(true)
                }}
              />
            </Box>
          </Section>
          <Section>
            <SectionDescription title="Delete account" description="" />

            <Box>xx</Box>
          </Section>
        </div>
      </div>
    </>
  )
}

SettingsPage.getLayout = (page: ReactElement) => {
  const router = useRouter()
  const { organization } = router.query
  const handle: string = typeof organization === 'string' ? organization : ''

  return (
    <>
      <Topbar>
        {{
          left: (
            <Link href={`/dashboard/${handle}`}>
              <ArrowLeftIcon className="h-6 w-6 text-black" />
            </Link>
          ),
          center: (
            <div className="flex items-center space-x-2 text-sm  font-medium">
              <div>Settings for</div>
              <RepoSelection />,
            </div>
          ),
        }}
      </Topbar>
      <div>{page}</div>
    </>
  )
}

const Section = ({ children }) => {
  return <div className="flex space-x-20 py-10">{children}</div>
}

const SectionDescription = ({ title, description }) => {
  return (
    <div className="w-80">
      <h2 className="text-[#101828]">{title}</h2>
      <p className="text-black/50">{description}</p>
    </div>
  )
}

const Box = ({ children }) => {
  return (
    <div className=" w-full rounded-md bg-white p-5 shadow-[0_0_20px_-5px_rgba(0,0,0,0.3)]">
      <form className="flex flex-col space-y-4">{children}</form>
    </div>
  )
}
const Checkbox = ({
  id,
  title,
  isChecked,
  onChange,
  description = undefined,
}: {
  id: string
  title: string
  description?: string
  isChecked: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) => {
  return (
    <div className="relative flex items-start">
      <div className="flex h-6 items-center">
        <input
          id={id}
          aria-describedby={`${id}-description`}
          name={id}
          type="checkbox"
          onChange={onChange}
          checked={isChecked}
          className="h-4 w-4 rounded border-gray-300 text-[#8A63F9] focus:ring-[#8A63F9]"
        />
      </div>
      <div className="ml-3 inline-flex items-center space-x-4 text-sm leading-6 ">
        <label htmlFor={id} className="font-medium text-black">
          {title}
        </label>{' '}
        {description && (
          <span
            id={`${id}-description`}
            className="inline-flex items-center space-x-2 text-black/50"
          >
            <InformationCircleIcon className="h-6 w-6" />
            <span>{description}</span>
          </span>
        )}
      </div>
    </div>
  )
}

export default SettingsPage
