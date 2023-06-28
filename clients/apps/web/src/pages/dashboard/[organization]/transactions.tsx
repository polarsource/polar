import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import Transactions from '@/components/Dashboard/Transactions/Transactions'
import type { NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { ReactElement, useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../hooks'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  useEffect(() => {
    if (isLoaded && !org) {
      router.push('/dashboard')
      return
    }
  }, [isLoaded, org, router])

  return (
    <>
      <Head>
        <title>Polar{org ? ` ${org.name}` : ''}</title>
      </Head>
      {org && <Transactions org={org} />}
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
