import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import LoadingScreen from '@/components/Dashboard/LoadingScreen'
import Layout from '@/components/Layout/EmptyLayout'
import type { NextPageWithLayout } from '@/utils/next'
import { useRouter } from 'next/router'
import { ReactElement, useEffect } from 'react'

/**
 * TODO: Delete me in October, 2023
 *
 * I used to be a route, now I'm a mere redirect.
 * You can remove me ~1 month from now to clean up the codebase.
 */
const Page: NextPageWithLayout = () => {
  const router = useRouter()
  useEffect(() => {
    router.push(`/feed`)
  }, [router])

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
