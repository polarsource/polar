import { DashboardEnvironment, DefaultFilters } from 'dashboard/index'
import Organization from 'dashboard/organization'
import type { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { ReactElement } from 'react'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()
  const { organization, repo } = router.query
  const key = `orgrepo-${organization}-${repo}` // use key to force reload of state
  return (
    <DashboardEnvironment key={key}>
      <Organization filters={DefaultFilters} onSetFilters={() => {}} />
    </DashboardEnvironment>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <>{page}</>
}

export default Page
