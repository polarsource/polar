import DashboardLayout from 'components/Layout/DashboardLayout'
import { useRouter } from 'next/router'
import { type OrganizationRead, type RepositoryRead } from 'polarkit/api/client'
import { requireAuth, useSSE, useUserOrganizations } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import React, { useEffect, useState } from 'react'
import { DashboardFilters } from './filters'

export const DefaultFilters: DashboardFilters = {
  tab: 'issues',
  q: '',
  statusBacklog: true,
  statusBuild: true,
  statusPullRequest: true,
  statusCompleted: false,
}

export const DashboardEnvironment = ({ children }) => {
  const { currentUser } = requireAuth()
  const userOrgQuery = useUserOrganizations(currentUser)

  const router = useRouter()

  const currentOrg = useStore((state) => state.currentOrg)
  const currentRepo = useStore((state) => state.currentRepo)
  //const setCurrentOrg = useStore((state) => state.setCurrentOrg)
  const setCurrentOrgRepo = useStore((state) => state.setCurrentOrgRepo)

  const setIsOrganizationAccount = useStore(
    (state) => state.setIsOrganizationAccount,
  )

  const [filters, setFilters] = useState<DashboardFilters>({
    ...DefaultFilters,
  })

  const organizations = userOrgQuery.data

  // Setup accurate org and repo state
  const { organization: orgSlug, repo: repoSlug } = router.query

  // TODO: Unless we're sending user-only events we should probably delay SSE
  useSSE(currentOrg?.platform, currentOrg?.name, currentRepo?.name)

  useEffect(() => {
    const isOrganizationAccount = organizations && organizations.length > 0
    setIsOrganizationAccount(isOrganizationAccount)

    if (isOrganizationAccount) {
      let org: OrganizationRead | undefined
      let repo: RepositoryRead | undefined

      if (orgSlug) {
        const orgSearch = organizations.filter((o) => o.name === orgSlug)
        org = orgSearch[0]
      }

      if (repoSlug) {
        const repoSearch = org.repositories.filter((r) => r.name === repoSlug)
        repo = repoSearch[0]
      }

      if (orgSlug) {
        if (repoSlug) {
          setCurrentOrgRepo(org, repo)
        } else {
          setCurrentOrgRepo(org, undefined)
        }
      } else {
        // Set a default org if none is selected via URL
        setCurrentOrgRepo(organizations[0], undefined)
      }
    }
  }, [organizations, orgSlug, repoSlug, router])

  if (userOrgQuery.isLoading) return <div></div>
  if (!userOrgQuery.isSuccess) return <div>Error</div>

  // Pass search filters to dynamic children
  const renderedChildren = React.Children.map(children, function (child) {
    return React.cloneElement(child, { filters })
  })

  return (
    <>
      <DashboardLayout filters={filters} onSetFilters={setFilters}>
        {renderedChildren}
      </DashboardLayout>
    </>
  )
}
