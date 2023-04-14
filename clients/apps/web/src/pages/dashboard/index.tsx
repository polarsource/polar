import Dashboard from 'components/Dashboard/Dashboard'
import DashboardLayout from 'components/Layout/DashboardLayout'
import OnboardingConnectReposToGetStarted from 'components/Onboarding/OnboardingConnectReposToGetStarted'
import type { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import {
  requireAuth,
  useCurrentOrgAndRepoFromURL,
  useUserOrganizations,
} from 'polarkit/hooks'
import { ReactElement } from 'react'

const Page: NextLayoutComponentType = () => {
  const { org, repo, isLoaded, haveOrgs } = useCurrentOrgAndRepoFromURL()
  const { currentUser } = requireAuth()
  const userOrgQuery = useUserOrganizations(currentUser)
  const router = useRouter()

  if (!isLoaded) {
    return <></>
  }

  if (!haveOrgs) {
    return (
      <DashboardLayout showSidebar={false} isPersonalDashboard={false}>
        <OnboardingConnectReposToGetStarted />
      </DashboardLayout>
    )
  }

  // redirect to first org
  if (haveOrgs && userOrgQuery?.data && userOrgQuery.data.length > 0) {
    const gotoOrg = userOrgQuery.data[0]
    router.push(`/dashboard/${gotoOrg.name}`)
    return
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
  return <>{page}</>
}

export default Page
