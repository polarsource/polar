'use client'

import LoadingScreen from '@/components/Dashboard/LoadingScreen'
import { useRouter } from 'next/navigation'
import { CONFIG } from 'polarkit/config'
import { useListOrganizations } from 'polarkit/hooks'
import { useEffect } from 'react'

export default function Page() {
  const listOrganizationsQuery = useListOrganizations()

  const router = useRouter()
  const orgs = listOrganizationsQuery?.data?.items

  useEffect(() => {
    if (!listOrganizationsQuery.isFetched) return

    // redirect to first org
    if (orgs && orgs.length > 0) {
      const gotoOrg = orgs[0]
      router.push(`/maintainer/${gotoOrg.name}/issues`)
      return
    }

    // This user have no orgs, send to GitHub for installation
    router.push(CONFIG.GITHUB_INSTALLATION_URL)
  }, [listOrganizationsQuery, orgs, router])

  return <LoadingScreen animate={true}>Setting you up...</LoadingScreen>
}

// Page.getLayout = (page: ReactElement) => {
//   return <Gatekeeper>{page}</Gatekeeper>
// }

// export default Page
