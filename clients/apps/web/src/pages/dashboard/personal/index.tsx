import Dashboard from '@/components/Dashboard'
import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import type { NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { ReactElement } from 'react'

const Page: NextLayoutComponentType = () => {
  return (
    <>
      <Head>
        <title>Polar</title>
      </Head>
      <Dashboard
        key="dashboard-personal"
        org={undefined}
        repo={undefined}
        isPersonal={true}
      />
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
