'use client'

import { useAuth, useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useRouter } from 'next/navigation'
import { useListAdminOrganizations } from 'polarkit/hooks'
import { useEffect } from 'react'
import ClientPage from './ClientPage'
import SetupPage from './SetupPage'

export default function Page() {
  const { authenticated, hasChecked } = useAuth()
  const { org } = useCurrentOrgAndRepoFromURL()
  const listOrganizationsQuery = useListAdminOrganizations()

  const router = useRouter()
  const orgs = listOrganizationsQuery?.data?.items

  const shouldRenderUpsellGithubApp = !org

  useEffect(() => {
    if (!authenticated && hasChecked) {
      router.push(`/signup/maintainer`)
      return
    }
  }, [listOrganizationsQuery, orgs, router, authenticated, hasChecked])

  return shouldRenderUpsellGithubApp ? <SetupPage /> : <ClientPage />
}
