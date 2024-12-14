'use client'

import { Organization } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const lastVisitedOrgSlug = 'last_visited_org_slug'

export function NavigateToOrganization({
  userOrganizations,
}: {
  userOrganizations: Organization[]
}) {
  const router = useRouter()

  useEffect(() => {
    const lastVisitedOrg = localStorage.getItem(lastVisitedOrgSlug)
    const orgSlug = userOrganizations.find((org) => org.slug === lastVisitedOrg)

    const targetSlug = orgSlug?.slug ?? userOrganizations[0].slug

    router.push(`/dashboard/${targetSlug}`)
  }, [router, userOrganizations])

  return null
}

export function UpdateLastVisitedOrg({
  organization,
}: {
  organization: Organization
}) {
  useEffect(() => {
    localStorage.setItem(lastVisitedOrgSlug, organization.slug)
  }, [organization])

  return null
}
