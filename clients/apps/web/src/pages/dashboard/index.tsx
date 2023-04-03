import { DashboardEnvironment, DefaultFilters } from 'dashboard/index'
import Organization from 'dashboard/organization'
import type { NextLayoutComponentType } from 'next'
import { ReactElement } from 'react'

const Page: NextLayoutComponentType = () => {
  return (
    <DashboardEnvironment>
      <Organization filters={DefaultFilters} onSetFilters={() => {}} />
    </DashboardEnvironment>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <>{page}</>
}

export default Page
