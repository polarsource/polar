import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import LoadingScreen from '@/components/Dashboard/LoadingScreen'
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

    // TODO: Get org fallback from `useCurrentOrgAndRepoFromURL` vs. have this logic scattered?
    if (
      haveOrgs &&
      listOrganizationsQuery?.data?.items &&
      listOrganizationsQuery.data.items.length > 0
    ) {
      const gotoOrg = listOrganizationsQuery.data.items[0]
      router.push(`/maintainer/${gotoOrg.name}/issues`)
      return
    }
    router.push(`/dependencies/personal`)
  })

  return (
    <>
      <LoadingScreen>
        <>Redirecting...</>
      </LoadingScreen>
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
