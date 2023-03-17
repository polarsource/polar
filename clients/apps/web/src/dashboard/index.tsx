import Layout from 'components/Layout/Dashboard'
import { CONFIG } from 'polarkit'
import { requireAuth, useSSE, useUserOrganizations } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import React, { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { DashboardFilters } from './filters'
import Initialize from './initialize'
import Organization from './organization'

const Root = () => {
  return <h3 className="mt-10 text-xl">Welcome</h3>
}

const DashboardEnvironment = ({ children }) => {
  const { currentUser } = requireAuth()
  const userOrgQuery = useUserOrganizations(currentUser?.id)
  const currentOrg = useStore((state) => state.currentOrg)
  const currentRepo = useStore((state) => state.currentRepo)
  const setCurrentOrgRepo = useStore((state) => state.setCurrentOrgRepo)
  // TODO: Unless we're sending user-only events we should probably delay SSE
  useSSE(currentOrg?.platform, currentOrg?.name, currentRepo?.name)

  const [filters, setFilters] = useState<DashboardFilters>({
    tab: 'issues',
    q: '',
    statusBacklog: true,
    statusBuild: true,
    statusPullRequest: true,
    statusCompleted: false,
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
      <Layout filters={filters} onSetFilters={setFilters}>
        {renderedChildren}
      </Layout>
    </>
  )
}

const router = createBrowserRouter([
  {
    path: '/dashboard',
    element: (
      <DashboardEnvironment>
        <Root />
      </DashboardEnvironment>
    ),
  },
  {
    path: '/dashboard/initialize/:orgSlug',
    element: <Initialize />,
  },
  {
    path: '/dashboard/:orgSlug',
    element: (
      <DashboardEnvironment>
        <Organization filters={{}} />
      </DashboardEnvironment>
    ),
  },
  {
    path: '/dashboard/:orgSlug/:repoSlug',
    element: (
      <DashboardEnvironment>
        <Organization filters={{}} />
      </DashboardEnvironment>
    ),
  },
])

const Dashboard = () => {
  const { currentUser } = requireAuth()

  return (
    <>
      <RouterProvider router={router} />
    </>
  )
}

export default Dashboard
