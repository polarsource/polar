import Dashboard from 'components/Dashboard/Dashboard'
import InviteOnly from 'components/Dashboard/InviteOnly'
import { useRequireAuth } from 'hooks'
import type { NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { ReactElement } from 'react'

const Page: NextLayoutComponentType = () => {
  const { currentUser } = useRequireAuth()
  if (currentUser && !currentUser.invite_only_approved) {
    return <InviteOnly />
  }

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
