import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Organization from './organization'
import Onboarding from './Onboarding'
import { requireAuth } from 'context/auth'
import { useUserOrganizations } from 'polarkit/hooks'

const Root = () => {
  return <h3 className="text-xl mt-10">Welcome</h3>
}

const router = createBrowserRouter([
  {
    path: '/dashboard',
    element: <Root />,
  },
  {
    path: '/dashboard/onboarding/init',
    element: <Onboarding />,
  },
  {
    path: '/dashboard/:slug',
    element: <Organization />,
  },
])

const Dashboard = () => {
  const { session } = requireAuth()

  if (!session.user) {
    return <div>Not authenticated</div>
  }

  const userOrgQuery = useUserOrganizations(session.user.id)

  if (userOrgQuery.isLoading) return <div>Loading...</div>

  if (!userOrgQuery.isSuccess) return <div>Error</div>

  const organizations = userOrgQuery.data
  if (!organizations.length) {
    window.location.href =
      'https://github.com/apps/polar-code/installations/new'
  }
  return <RouterProvider router={router} />
}

export default Dashboard
