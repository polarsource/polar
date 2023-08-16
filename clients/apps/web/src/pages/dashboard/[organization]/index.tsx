import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import type { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { useListOrganizations } from 'polarkit/hooks'
import { ReactElement, useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../hooks'

/**
 * TODO: Delete me in October, 2023
 *
 * I used to be a route, now I'm a mere redirect.
 * You can remove me ~1 month from now to clean up the codebase.
 */
const Page: NextLayoutComponentType = () => {
  const { haveOrgs, isLoaded } = useCurrentOrgAndRepoFromURL()

  const listOrganizationsQuery = useListOrganizations()

  const router = useRouter()

  const orgs = listOrganizationsQuery?.data?.items

  useEffect(() => {
    if (!isLoaded) return

    // Redirect to first org
    if (haveOrgs && orgs && orgs.length > 0) {
      const gotoOrg = orgs[0]
      router.push(`/maintainer/${gotoOrg.name}/issues`)
      return
    }

    router.push('/feed')
  }, [haveOrgs, isLoaded, router, orgs])

  return <></>
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
