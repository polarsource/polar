import { ArrowLeftIcon } from '@heroicons/react/24/solid'
import { BadgeSettings } from 'components/Settings/BadgeSettings'
import { Box } from 'components/Settings/Box'
import PaymentSettings from 'components/Settings/PaymentSettings'
import { SettingsCheckbox } from 'components/Settings/SettingsCheckbox'
import Spinner from 'components/Shared/Spinner'
import Topbar from 'components/Shared/Topbar'
import { NextLayoutComponentType } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { OrganizationSettingsUpdate } from 'polarkit/api/client'
import { RepoSelection } from 'polarkit/components'
import {
  useOrganization,
  useOrganizationSettingsMutation,
} from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import { ReactElement, useEffect, useRef, useState } from 'react'

const SettingsPage: NextLayoutComponentType = () => {
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

  const setCurrentOrgRepo = useStore((state) => state.setCurrentOrgRepo)

  useEffect(() => {
    if (!org) {
      return
    }

    setCurrentOrgRepo(org, undefined)

    if (didFirstSet.current) {
      return
    }

    // On first load, set values from API
    // After first load, treat local values as the source of truth, and send them to the API
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
  }, [org, setCurrentOrgRepo])

  const mutation = useOrganizationSettingsMutation()

  const [showDidSave, setShowDidSave] = useState(false)

  const didSaveTimeout = useRef<undefined | ReturnType<typeof setTimeout>>(
    undefined,
  )

  const save = (set: OrganizationSettingsUpdate) => {
    mutation.mutate({
      orgName: handle,
      body: { ...org, ...set },
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

  // show spinner if still loading after 1s
  const [allowShowLoadingSpinner, setAllowShowLoadingSpinner] = useState(false)
  setTimeout(() => {
    setAllowShowLoadingSpinner(true)
  }, 1000)

  if (orgData.isError) {
    return (
      <>
        <div className="mx-auto mt-24 flex max-w-[1100px] flex-col items-center">
          <span>Organization not found</span>
          <span>404 Not Found</span>
        </div>
      </>
    )
  }

  if (orgData.isLoading) {
    return (
      <>
        <div className="mx-auto mt-24 flex max-w-[1100px] flex-col items-center text-black">
          {allowShowLoadingSpinner && (
            <div className="flex items-center space-x-4">
              <span>Loading</span>
              <Spinner />
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="mx-auto max-w-[1100px] md:mt-24">
        <div className="pl-80">
          {showDidSave && <div className="h-4 text-black/50">Saved!</div>}
          {!showDidSave && <div className="h-4"></div>}
        </div>

        <div className="divide-y divide-gray-200">
          <Section>
            <SectionDescription
              title="Payment details"
              description={`Default payment methods for the ${org.name} organization to use when pledning new issues.`}
            />

            <Box>
              <PaymentSettings org={org} />
            </Box>
          </Section>

          <Section>
            <SectionDescription
              title="Polar badge"
              description="Polar will inject this badge into new issues on Github."
            />

            <Box>
              <BadgeSettings
                badgeAddOldIssues={badgeAddOldIssues}
                badgeShowRaised={badgeShowRaised}
                setBadgeAddOldIssues={(value) => {
                  setBadgeAddOldIssues(value)
                  save({ funding_badge_retroactive: value })
                }}
                setBadgeShowRaised={(value) => {
                  setBadgeShowRaised(value)
                  save({ funding_badge_show_amount: value })
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
              <SettingsCheckbox
                id="email-backing"
                title="Issue receives backing"
                isChecked={emailIssueReceivesBacking}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEmailIssueReceivesBacking(e.target.checked)
                  save({
                    email_notification_issue_receives_backing: e.target.checked,
                  })
                }}
              />
              <SettingsCheckbox
                id="email-branch-created"
                title="Branch created for issue with backing"
                isChecked={emailIssueBranchCreated}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEmailIssueBranchCreated(e.target.checked)
                  save({
                    email_notification_backed_issue_branch_created:
                      e.target.checked,
                  })
                }}
              />
              <SettingsCheckbox
                id="email-pr-created"
                title="Pull request created for issue with backing"
                isChecked={emailPullRequestCreated}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEmailPullRequestCreated(e.target.checked)
                  save({
                    email_notification_backed_issue_pull_request_created:
                      e.target.checked,
                  })
                }}
              />
              <SettingsCheckbox
                id="email-pr-merged"
                title="Pull request merged for issue with backing"
                isChecked={emailPullRequestMerged}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEmailPullRequestMerged(e.target.checked)
                  save({
                    email_notification_backed_issue_pull_request_merged:
                      e.target.checked,
                  })
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

const SettingsTopbar = () => {
  const router = useRouter()
  const { organization } = router.query
  const handle: string = typeof organization === 'string' ? organization : ''

  const currentOrg = useStore((state) => state.currentOrg)

  return (
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
            <RepoSelection
              showRepositories={false}
              showConnectMore={false}
              currentOrg={currentOrg}
              onSelectOrg={(org) => router.push(`/settings/${org}`)}
            />
          </div>
        ),
      }}
    </Topbar>
  )
}

SettingsPage.getLayout = (page: ReactElement) => {
  return (
    <>
      <SettingsTopbar />
      <div>{page}</div>
    </>
  )
}

const Section = ({ children }) => {
  return (
    <div className="flex flex-col space-y-4 p-4 py-10 md:flex-row md:space-x-20 md:space-y-0">
      {children}
    </div>
  )
}

const SectionDescription = ({ title, description }) => {
  return (
    <div className="flex-shrink-0 md:w-60">
      <h2 className="text-[#101828]">{title}</h2>
      <p className="text-black/50">{description}</p>
    </div>
  )
}

export default SettingsPage
