import DashboardLayout from 'components/Layout/DashboardLayout'
import OnboardingConnectReposToGetStarted from 'components/Onboarding/OnboardingConnectReposToGetStarted'
import { useRouter } from 'next/router'
import { IssueListType } from 'polarkit/api/client'
import { useCurrentOrgAndRepoFromURL, useSSE } from 'polarkit/hooks'
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
  const router = useRouter()
  const { org, repo, isLoaded, haveOrgs } = useCurrentOrgAndRepoFromURL()

  const initFilters = {
    ...DefaultFilters,
  }

  const didSetFiltersFromURL = useRef(false)

  const [filters, setFilters] = useState<DashboardFilters>(initFilters)

  // TODO: Unless we're sending user-only events we should probably delay SSE
  useSSE(org?.platform, org?.name, org?.name)

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
  }, [router.query])

  if (!isLoaded) {
    return (
      <DashboardLayout
        filters={filters}
        onSetFilters={setFilters}
        showSidebar={true}
      >
        Loading...
      </DashboardLayout>
    )
  }

  if (!org) {
    return (
      <DashboardLayout
        filters={filters}
        onSetFilters={setFilters}
        showSidebar={false}
      >
        <OnboardingConnectReposToGetStarted />
      </DashboardLayout>
    )
  }

  // Pass search filters to dynamic children
  const renderedChildren = React.Children.map(children, function (child) {
    return React.cloneElement(child, { filters, onSetFilters: setFilters })
  })

  return (
    <>
      <DashboardLayout
        filters={filters}
        onSetFilters={setFilters}
        showSidebar={true}
      >
        {renderedChildren}
      </DashboardLayout>
    </>
  )
}
