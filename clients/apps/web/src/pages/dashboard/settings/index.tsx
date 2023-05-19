import LoadingScreen from '@/components/Dashboard/LoadingScreen'
import Layout from '@/components/Layout/EmptyLayout'
import { useRequireAuth } from '@/hooks/auth'
import type { NextPageWithLayout } from '@/utils/next'
import { useRouter } from 'next/router'
import { useUserOrganizations } from 'polarkit/hooks'
import { ReactElement, useEffect } from 'react'

const Page: NextPageWithLayout = () => {
  const { currentUser } = useRequireAuth()
  const userOrgQuery = useUserOrganizations(currentUser)
  const router = useRouter()

  useEffect(() => {
    if (!userOrgQuery.data) {
      return
    }
    if (userOrgQuery.data.length === 0) {
      return
    }
    router.push(`/dashboard/settings/${userOrgQuery.data[0].name}`)
  }, [userOrgQuery])

  return (
    <>
      <LoadingScreen>
        <>Redirecting...</>
      </LoadingScreen>
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <Layout>{page}</Layout>
}

export default Page
