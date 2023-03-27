import { DashboardEnvironment, DefaultFilters } from 'dashboard/index'
import Organization from 'dashboard/organization'
import type { NextPage } from 'next'
import { ReactElement } from 'react'

const Page: NextPage = () => {
  return (
    <DashboardEnvironment>
      <Organization filters={DefaultFilters} />
    </DashboardEnvironment>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <>{page}</>
}

export default Page
