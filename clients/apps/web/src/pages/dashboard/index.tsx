import Dashboard, { DefaultFilters } from 'components/Dashboard/Dashboard'
import Gatekeeper from 'components/Dashboard/Gatekeeper/Gatekeeper'
import DashboardLayout from 'components/Layout/DashboardLayout'
import OnboardingConnectReposToGetStarted from 'components/Onboarding/OnboardingConnectReposToGetStarted'
import type { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { useListPersonalPledges, useUserOrganizations } from 'polarkit/hooks'
import { ReactElement, useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL, useRequireAuth } from '../../hooks'

const Page: NextLayoutComponentType = () => {
  const { isLoaded, haveOrgs } = useCurrentOrgAndRepoFromURL()
  const { currentUser } = useRequireAuth()

  const userOrgQuery = useUserOrganizations(currentUser)
  const personalPledges = useListPersonalPledges()

  const router = useRouter()

  useEffect(() => {
    const havePersonalPledges =
      (personalPledges?.data && personalPledges?.data.length > 0) || false

    // Show personal dashboard
    if (!haveOrgs && havePersonalPledges) {
      router.push(`/dashboard/personal`)
      return
    }

    // redirect to first org
    if (haveOrgs && userOrgQuery?.data && userOrgQuery.data.length > 0) {
      const gotoOrg = userOrgQuery.data[0]
      router.push(`/dashboard/${gotoOrg.name}`)
      return
    }
  })

  if (!isLoaded) {
    return <></>
  }

  if (!haveOrgs) {
    return (
      <DashboardLayout
        showSidebar={false}
        isPersonalDashboard={false}
        filters={DefaultFilters}
        onSetFilters={() => {}}
      >
        <OnboardingConnectReposToGetStarted />
      </DashboardLayout>
    )
  }

  return (
    <Dashboard
      key="dashboard-root"
      org={undefined}
      repo={undefined}
      isPersonal={false}
    />
  )
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
