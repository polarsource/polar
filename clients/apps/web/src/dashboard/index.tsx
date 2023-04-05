import DashboardLayout from 'components/Layout/DashboardLayout'
import { useRouter } from 'next/router'
import {
  IssueListType,
  type OrganizationRead,
  type RepositoryRead,
} from 'polarkit/api/client'
import { requireAuth, useSSE, useUserOrganizations } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import React, { useEffect, useRef, useState } from 'react'
import { DashboardFilters } from './filters'

export const DefaultFilters: DashboardFilters = {
  tab: IssueListType.ISSUES,
  q: '',
  statusBacklog: true,
  statusBuild: true,
  statusPullRequest: true,
  statusCompleted: false,
  sort: undefined,
}

const getTab = (tab: string): IssueListType => {
  if (tab === 'following') {
    return IssueListType.FOLLOWING
  }
  return IssueListType.ISSUES
}

export const DashboardEnvironment = ({ children }) => {
  const { currentUser } = requireAuth()
  const userOrgQuery = useUserOrganizations(currentUser)

  const router = useRouter()

  const currentOrg = useStore((state) => state.currentOrg)
  const currentRepo = useStore((state) => state.currentRepo)
  const setCurrentOrgRepo = useStore((state) => state.setCurrentOrgRepo)

  const setIsOrganizationAccount = useStore(
    (state) => state.setIsOrganizationAccount,
  )

  const initFilters = {
    ...DefaultFilters,
  }

  const didSetFiltersFromURL = useRef(false)

  const [filters, setFilters] = useState<DashboardFilters>(initFilters)

  const organizations = userOrgQuery.data

  // TODO: Unless we're sending user-only events we should probably delay SSE
  useSSE(currentOrg?.platform, currentOrg?.name, currentRepo?.name)

  useEffect(() => {
    // Parse URL and use it to populate filters
    // TODO: can we do this on the initial load instead to avoid the effect / and ref
    if (!didSetFiltersFromURL.current) {
      didSetFiltersFromURL.current = true
      const s = new URLSearchParams(window.location.search)

      const f = {
        ...DefaultFilters,
        q: s.get('q'),
        tab: getTab(s.get('tab')),
      }
      if (s.has('statuses')) {
        const statuses = s.get('statuses').split(',')
        f.statusBacklog = statuses.includes('backlog')
        f.statusBuild = statuses.includes('build')
        f.statusPullRequest = statuses.includes('pull_request')
        f.statusCompleted = statuses.includes('completed')
      }

      setFilters(f)
    }

    // Setup accurate org and repo state
    const { organization: orgSlug, repo: repoSlug } = router.query

    const isOrganizationAccount = organizations && organizations.length > 0
    setIsOrganizationAccount(isOrganizationAccount)

    if (isOrganizationAccount) {
      let org: OrganizationRead | undefined
      let repo: RepositoryRead | undefined

      if (orgSlug && organizations) {
        const orgSearch = organizations.filter((o) => o.name === orgSlug)
        org = orgSearch[0]
      }

      if (repoSlug && org?.repositories) {
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
  }, [organizations, router.query, setCurrentOrgRepo, setIsOrganizationAccount])

  if (userOrgQuery.isLoading) return <div></div>
  if (!userOrgQuery.isSuccess) return <div>Error</div>

  // Pass search filters to dynamic children
  const renderedChildren = React.Children.map(children, function (child) {
    return React.cloneElement(child, { filters, onSetFilters: setFilters })
  })

  return (
    <>
      <DashboardLayout filters={filters} onSetFilters={setFilters}>
        {renderedChildren}
      </DashboardLayout>
    </>
  )
}
