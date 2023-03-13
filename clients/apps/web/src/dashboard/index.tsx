import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Organization from './organization'
import Initialize from './initialize'
import { requireAuth } from 'polarkit/hooks'
import { useUserOrganizations } from 'polarkit/hooks'
import Layout from 'components/Layout/Dashboard'
import { useSSE } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import { CONFIG } from 'polarkit'
import { useState } from 'react'
import { DashboardFilters } from './filters'

const Root = () => {
  return <h3 className="text-xl mt-10">Welcome</h3>
}

const DashboardEnvironment = ({ children }) => {
  const { currentUser } = requireAuth()
  const userOrgQuery = useUserOrganizations(currentUser?.id)
  const currentOrg = useStore((state) => state.currentOrg)
  const currentRepo = useStore((state) => state.currentRepo)
  const setCurrentOrgRepo = useStore((state) => state.setCurrentOrgRepo)
  // TODO: Unless we're sending user-only events we should probably delay SSE
  useSSE(currentOrg?.id, currentRepo?.id)

  const [filters, setFilters] = useState<DashboardFilters>({
    tab: "issues",
    q: "",
    statusBacklog: true,
    statusBuild: true,
    statusPullRequest: true,
    statusCompleted: false,
  })

  if (userOrgQuery.isLoading) return <div>Loading...</div>

  if (!userOrgQuery.isSuccess) return <div>Error</div>

  const organizations = userOrgQuery.data
  if (!organizations.length) {
    window.location.replace(CONFIG.GITHUB_INSTALLATION_URL)
  }

  if (!currentOrg || !currentRepo) {
    const defaultSelected = organizations[0]
    if (defaultSelected) {
      setCurrentOrgRepo(defaultSelected, defaultSelected.repositories[0])
    }
  }

  return (
    <>
      <Layout filters={filters} onSetFilters={setFilters}>
        <pre>{JSON.stringify(filters, 2, 4)}</pre>
        {children}
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
        <Organization />
      </DashboardEnvironment>
    ),
  },
  {
    path: '/dashboard/:orgSlug/:repoSlug',
    element: (
      <DashboardEnvironment>
        <Organization />
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
