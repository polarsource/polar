import Dashboard from 'components/Dashboard/Dashboard'
import DashboardLayout from 'components/Layout/DashboardLayout'
import OnboardingConnectReposToGetStarted from 'components/Onboarding/OnboardingConnectReposToGetStarted'
import type { NextLayoutComponentType } from 'next'
import { useCurrentOrgAndRepoFromURL } from 'polarkit/hooks'
import { ReactElement } from 'react'

const Page: NextLayoutComponentType = () => {
  const { org, repo, isLoaded, haveOrgs } = useCurrentOrgAndRepoFromURL()
  if (!isLoaded) {
    return <></>
  }
  if (!haveOrgs) {
    return (
      <DashboardLayout showSidebar={false}>
        <OnboardingConnectReposToGetStarted />
      </DashboardLayout>
    )
  }
  return <Dashboard org={undefined} repo={undefined} haveOrgs={haveOrgs} />
}

Page.getLayout = (page: ReactElement) => {
  return <>{page}</>
}

export default Page
