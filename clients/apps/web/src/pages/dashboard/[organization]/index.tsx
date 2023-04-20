import Dashboard from 'components/Dashboard/Dashboard'
import type { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { ReactElement, useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../hooks'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()
  const { organization } = router.query
  const key = `org-${organization}` // use key to force reload of state
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  useEffect(() => {
    if (isLoaded && !org) {
      router.push('/dashboard')
      return
    }
  }, [isLoaded, org])

  if (!isLoaded) {
    return <></>
  }

  return <Dashboard key={key} org={org} repo={undefined} isPersonal={false} />
}

Page.getLayout = (page: ReactElement) => {
  return <>{page}</>
}

export default Page
