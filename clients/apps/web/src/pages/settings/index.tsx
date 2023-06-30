import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import LoadingScreen from '@/components/Dashboard/LoadingScreen'
import Layout from '@/components/Layout/EmptyLayout'
import type { NextPageWithLayout } from '@/utils/next'
import { useRouter } from 'next/router'
import { ReactElement, useEffect } from 'react'

const Page: NextPageWithLayout = () => {
  const router = useRouter()
  useEffect(() => {
    router.push(`/settings/personal`)
  })

  return (
    <>
      <LoadingScreen>
        <>Redirecting...</>
      </LoadingScreen>
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return (
    <Gatekeeper>
      <Layout>{page}</Layout>
    </Gatekeeper>
  )
}

export default Page
