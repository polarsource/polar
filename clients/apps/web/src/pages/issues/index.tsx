import Dashboard, { DefaultFilters } from '@/components/Dashboard'
import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import DashboardIssuesFilterLayout from '@/components/Layout/DashboardIssuesFilterLayout'
import OnboardingConnectReposToGetStarted from '@/components/Onboarding/OnboardingConnectReposToGetStarted'
import type { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { useListOrganizations, useListPersonalPledges } from 'polarkit/hooks'
import { ReactElement, useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../hooks'

const Page: NextLayoutComponentType = () => {
  const { isLoaded, haveOrgs } = useCurrentOrgAndRepoFromURL()

  const listOrganizationsQuery = useListOrganizations()
  const personalPledges = useListPersonalPledges()

  const router = useRouter()

  useEffect(() => {
    const havePersonalPledges =
      (personalPledges?.data && personalPledges?.data.length > 0) || false

    // Show personal dashboard
    if (!haveOrgs && havePersonalPledges) {
      router.push(`/issues/personal`)
      return
    }

    // redirect to first org
    if (
      haveOrgs &&
      listOrganizationsQuery?.data &&
      listOrganizationsQuery.data.length > 0
    ) {
      const gotoOrg = listOrganizationsQuery.data[0]
      router.push(`/issues/${gotoOrg.name}`)
      return
    }
  })

  if (!isLoaded) {
    return <></>
  }

  if (!haveOrgs) {
    return (
      <DashboardIssuesFilterLayout
        isPersonalDashboard={false}
        filters={DefaultFilters}
        onSetFilters={() => {}}
      >
        <OnboardingConnectReposToGetStarted />
      </DashboardIssuesFilterLayout>
    )
  }

  return (
    <Dashboard
      key="dashboard-root"
      org={undefined}
      repo={undefined}
      isPersonal={false}
      isDependencies={false}
    />
  )
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
