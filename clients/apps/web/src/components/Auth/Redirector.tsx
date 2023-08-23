'use client'

import LoadingScreen from '@/components/Dashboard/LoadingScreen'
import { useAuth } from '@/hooks/auth'
import { useRouter } from 'next/navigation'
import { useListOrganizations } from 'polarkit/hooks'
import { useEffect } from 'react'

export const useLoginRedirect = () => {
  const { currentUser, hasChecked } = useAuth()
  const listOrganizationsQuery = useListOrganizations()
  const router = useRouter()
  const orgs = listOrganizationsQuery?.data?.items

  useEffect(() => {
    // user is not logged in
    if (hasChecked && !currentUser) {
      router.push('/login')
      return
    }

    // redirect to first org
    if (
      // hasChecked &&
      currentUser &&
      listOrganizationsQuery.isFetched &&
      orgs &&
      orgs.length > 0
    ) {
      const gotoOrg = orgs[0]
      router.push(`/maintainer/${gotoOrg.name}/issues`)
      return
    }

    if (
      // hasChecked &&
      currentUser &&
      listOrganizationsQuery.isFetched &&
      orgs &&
      orgs.length == 0
    ) {
      // user have no orgs, send to /feed
      router.push('/feed')
      return
    }
  }, [listOrganizationsQuery, orgs, router])
}

const Redirector = () => {
  useLoginRedirect()
  return <LoadingScreen>Initializing...</LoadingScreen>
}

export default Redirector
