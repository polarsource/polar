import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import type { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { useListOrganizations, useListPersonalPledges } from 'polarkit/hooks'
import { ReactElement, useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../hooks'

/**
 * TODO: Delete me in October, 2023
 *
 * I used to be a route, now I'm a mere redirect.
 * You can remove me ~1 month from now to clean up the codebase.
 */
const Page: NextLayoutComponentType = () => {
  const { haveOrgs } = useCurrentOrgAndRepoFromURL()

  const listOrganizationsQuery = useListOrganizations()
  const personalPledges = useListPersonalPledges()

  const router = useRouter()

  useEffect(() => {
    const havePersonalPledges =
      (personalPledges?.data && personalPledges?.data.length > 0) || false

    // Redirect to personal
    if (!haveOrgs && havePersonalPledges) {
      router.push(`/feed`)
      return
    }

    // Redirect to first org
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

  return <></>
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
