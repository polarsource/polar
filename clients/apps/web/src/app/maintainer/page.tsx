'use client'

import LoadingScreen from '@/components/Dashboard/LoadingScreen'
import { useAuth } from '@/hooks'
import { useRouter } from 'next/navigation'
import { useListAdminOrganizations } from 'polarkit/hooks'
import { useEffect } from 'react'

export default function Page() {
  const { authenticated, hasChecked } = useAuth()
  const listOrganizationsQuery = useListAdminOrganizations()

  const router = useRouter()
  const orgs = listOrganizationsQuery?.data?.items

  useEffect(() => {
    if (!authenticated && hasChecked) {
      router.push(`/signup/maintainer`)
      return
    }

    if (!listOrganizationsQuery.isFetched) return

    // redirect to first org
    if (orgs && orgs.length > 0) {
      const gotoOrg = orgs[0]
      router.push(`/maintainer/${gotoOrg.name}/issues`)
      return
    } else {
      router.push('/')
    }
  }, [listOrganizationsQuery, orgs, router, authenticated, hasChecked])

  return <LoadingScreen animate={true}>Setting you up...</LoadingScreen>
}
