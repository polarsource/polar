import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Organization from './organization'
import Onboarding from './Onboarding'
import { requireAuth } from 'polarkit/hooks'
import { useUserOrganizations } from 'polarkit/hooks'
import Layout from 'components/Layout/Dashboard'
import { useSSE } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import { CONFIG } from 'polarkit'

const Root = () => {
  return <h3 className="text-xl mt-10">Welcome</h3>
}

const router = createBrowserRouter([
  {
    path: '/dashboard',
    element: (
      <Layout>
        <Root />
      </Layout>
    ),
  },
  {
    path: '/dashboard/onboarding/init',
    element: (
      <Layout>
        <Onboarding />
      </Layout>
    ),
  },
  {
    path: '/dashboard/:orgSlug',
    element: (
      <Layout>
        <Organization />
      </Layout>
    ),
  },
  {
    path: '/dashboard/:orgSlug/:repoSlug',
    element: (
      <Layout>
        <Organization />
      </Layout>
    ),
  },
])

const Dashboard = () => {
  const { currentUser } = requireAuth()
  const userOrgQuery = useUserOrganizations(currentUser?.id)
  const currentOrg = useStore((state) => state.currentOrg)
  const currentRepo = useStore((state) => state.currentRepo)
  const setCurrentOrgRepo = useStore((state) => state.setCurrentOrgRepo)
  // TODO: Unless we're sending user-only events we should probably delay SSE
  useSSE(currentOrg?.id, currentRepo?.id)

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
      <RouterProvider router={router} />
    </>
  )
}

export default Dashboard
