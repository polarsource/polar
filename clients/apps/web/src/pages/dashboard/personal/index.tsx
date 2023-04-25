import Dashboard from 'components/Dashboard/Dashboard'
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
        key="dashboard-parsonal"
        org={undefined}
        repo={undefined}
        isPersonal={true}
      />
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <>{page}</>
}

export default Page
