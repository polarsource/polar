import type { ReactElement } from 'react'
import type { NextPageWithLayout } from 'utils/next'
import dynamic from 'next/dynamic'
import Layout from 'components/Dashboard/Layout'
import { requireAuth } from 'polarkit/context/auth'

const Dashboard = dynamic(() => import('../../dashboard'), {
  ssr: false,
})

const DashboardSPA: NextPageWithLayout = () => {
  requireAuth()

  return <Dashboard />
}

DashboardSPA.getLayout = (page: ReactElement) => {
  return <Layout>{page}</Layout>
}

export default DashboardSPA
