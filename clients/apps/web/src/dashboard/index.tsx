import DashboardLayout from 'components/Layout/DashboardLayout'
import { useRouter } from 'next/router'
import { CONFIG } from 'polarkit'
import { requireAuth, useSSE, useUserOrganizations } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import React, { useState } from 'react'
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
  const userOrgQuery = useUserOrganizations(currentUser?.id)

  const router = useRouter()
  const { organization, repo } = router.query

  const currentOrg = useStore((state) => state.currentOrg)
  const currentRepo = useStore((state) => state.currentRepo)

  // TODO: Unless we're sending user-only events we should probably delay SSE
  useSSE(currentOrg?.platform, currentOrg?.name, currentRepo?.name)

  const [filters, setFilters] = useState<DashboardFilters>({
    ...DefaultFilters,
  })

  const organizations = userOrgQuery.data

  if (userOrgQuery.isLoading) return <div>Loading...</div>

  if (!userOrgQuery.isSuccess) return <div>Error</div>

  if (!organizations.length) {
    window.location.replace(CONFIG.GITHUB_INSTALLATION_URL)
  }

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
