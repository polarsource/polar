import { ArrowLeftIcon } from '@heroicons/react/24/solid'
import RepoSelection from 'components/Dashboard/RepoSelection'
import { BadgeSettings } from 'components/Settings/BadgeSettings'
import Box from 'components/Settings/Box'
import NotificationSettings, {
  type Settings as NotificationSettingsValues,
} from 'components/Settings/NotificationSettings'
import PaymentSettings, {
  type Settings as PaymentSettingsValues,
} from 'components/Settings/PaymentSettings'
import Spinner from 'components/Shared/Spinner'
import Topbar from 'components/Shared/Topbar'
import { NextLayoutComponentType } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { OrganizationSettingsUpdate } from 'polarkit/api/client'
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

  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettingsValues>()

  const [paymentSettings, setPaymentSettings] =
    useState<PaymentSettingsValues>()

  const didFirstSetForOrg = useRef<string>('')
  const setCurrentOrgRepo = useStore((state) => state.setCurrentOrgRepo)

  useEffect(() => {
    if (!org) {
      return
    }

    setCurrentOrgRepo(org, undefined)

    // If org changes, or if this is the first time we load this org, build states
    if (didFirstSetForOrg.current === org.id) {
      return
    }

    // On first load, set values from API
    // After first load, treat local values as the source of truth, and send them to the API
    setBadgeAddOldIssues(!!org.pledge_badge_retroactive)
    setBadgeShowRaised(!!org.pledge_badge_show_amount)

    setNotificationSettings({
      email_notification_maintainer_issue_receives_backing:
        org.email_notification_maintainer_issue_receives_backing,
      email_notification_maintainer_issue_branch_created:
        org.email_notification_maintainer_issue_branch_created,
      email_notification_maintainer_pull_request_created:
        org.email_notification_maintainer_pull_request_created,
      email_notification_maintainer_pull_request_merged:
        org.email_notification_maintainer_pull_request_merged,
      email_notification_backed_issue_branch_created:
        org.email_notification_backed_issue_branch_created,
      email_notification_backed_issue_pull_request_created:
        org.email_notification_backed_issue_pull_request_created,
      email_notification_backed_issue_pull_request_merged:
        org.email_notification_backed_issue_pull_request_merged,
    })

    setPaymentSettings({
      billing_email: org.billing_email,
    })

    didFirstSetForOrg.current = org.id
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

  const onNotificationSettingsUpdated = (val: NotificationSettingsValues) => {
    save(val)
    setNotificationSettings(val)
  }

  const onPaymentSettingsUpdated = (val: PaymentSettingsValues) => {
    save(val)
    setPaymentSettings(val)
  }

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
      <Head>
        <title>Polar | Settings for {handle}</title>
      </Head>

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
              <PaymentSettings
                org={org}
                onUpdated={onPaymentSettingsUpdated}
                settings={paymentSettings}
              />
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
                  save({ pledge_badge_retroactive: value })
                }}
                setBadgeShowRaised={(value) => {
                  setBadgeShowRaised(value)
                  save({ pledge_badge_show_amount: value })
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
              <NotificationSettings
                settings={notificationSettings}
                orgName={org.name}
                onUpdated={onNotificationSettingsUpdated}
              />
            </Box>
          </Section>

          <Section>
            <SectionDescription title="Delete account" description="" />

            <Box>
              <>xx</>
            </Box>
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
              onSelectOrg={(org) => router.push(`/dashboard/settings/${org}`)}
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
      <h2 className="mb-2 font-medium text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  )
}

export default SettingsPage
