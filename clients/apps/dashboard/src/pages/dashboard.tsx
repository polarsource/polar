import type { ReactElement } from 'react'
import type { NextPageWithLayout } from 'utils/next'
import { requireAuth } from 'context/auth'
import dynamic from 'next/dynamic'
import Layout from 'components/Dashboard/Layout'

const Dashboard = dynamic(() => import('../dashboard'), {
  ssr: false,
})

const SafeHydration = ({ children }) => {
  return (
    <div suppressHydrationWarning>
      {typeof document === 'undefined' ? null : children}
    </div>
  )
}

const DashboardSPA: NextPageWithLayout = () => {
  const { developer } = requireAuth()

  return (
    <SafeHydration>
      <Dashboard />
    </SafeHydration>
  )
}

DashboardSPA.getLayout = (page: ReactElement) => {
  return <Layout>{page}</Layout>
}

export default DashboardSPA
