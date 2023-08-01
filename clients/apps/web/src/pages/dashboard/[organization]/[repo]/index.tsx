import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import type { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { useListOrganizations, useListPersonalPledges } from 'polarkit/hooks'
import { ReactElement, useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../../hooks'

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
      router.push(`/issues/personal`)
      return
    }

    // Redirect to first org
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

  return <></>
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
