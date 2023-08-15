import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import OnboardingConnectReposToGetStarted from '@/components/Onboarding/OnboardingConnectReposToGetStarted'
import type { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { useListOrganizations } from 'polarkit/hooks'
import { ReactElement, useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../hooks'

const Page: NextLayoutComponentType = () => {
  const { isLoaded, haveOrgs } = useCurrentOrgAndRepoFromURL()
  const listOrganizationsQuery = useListOrganizations()

  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return

    // redirect to first org
    if (
      haveOrgs &&
      listOrganizationsQuery?.data?.items &&
      listOrganizationsQuery.data.items.length > 0
    ) {
      const gotoOrg = listOrganizationsQuery.data.items[0]
      router.push(`/maintainer/${gotoOrg.name}/issues`)
      return
    }
  })

  if (!isLoaded) {
    return <></>
  }

  return <OnboardingConnectReposToGetStarted />
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
