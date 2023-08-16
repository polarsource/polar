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
  const orgs = listOrganizationsQuery?.data?.items

  useEffect(() => {
    if (!isLoaded) return

    // redirect to first org
    if (haveOrgs && orgs && orgs.length > 0) {
      const gotoOrg = orgs[0]
      router.push(`/maintainer/${gotoOrg.name}/issues`)
      return
    }

    router.push('/feed')
  }, [isLoaded, haveOrgs, orgs, router])

  if (!isLoaded) {
    return <></>
  }

  return <OnboardingConnectReposToGetStarted />
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
