import Dashboard from 'components/Dashboard/Dashboard'
import type { NextLayoutComponentType } from 'next'
import { ReactElement } from 'react'

const Page: NextLayoutComponentType = () => {
  return (
    <Dashboard
      key="dashboard-parsonal"
      org={undefined}
      repo={undefined}
      haveOrgs={true}
      isPersonal={true}
    />
  )
}

Page.getLayout = (page: ReactElement) => {
  return <>{page}</>
}

export default Page
