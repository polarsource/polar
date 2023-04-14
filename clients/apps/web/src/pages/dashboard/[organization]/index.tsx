import Dashboard from 'components/Dashboard/Dashboard'
import type { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { useCurrentOrgAndRepoFromURL } from 'polarkit/hooks'
import { ReactElement } from 'react'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()
  const { organization } = router.query
  const key = `org-${organization}` // use key to force reload of state
  const { org, repo, isLoaded, haveOrgs } = useCurrentOrgAndRepoFromURL()
  if (!isLoaded) {
    return <></>
  }
  if (isLoaded && !org) {
    router.push('/dashboard')
    return
  }
  return <Dashboard key={key} org={org} repo={undefined} haveOrgs={haveOrgs} />
}

Page.getLayout = (page: ReactElement) => {
  return <>{page}</>
}

export default Page
