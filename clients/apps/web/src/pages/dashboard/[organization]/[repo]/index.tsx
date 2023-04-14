import Dashboard from 'components/Dashboard/Dashboard'
import type { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { useCurrentOrgAndRepoFromURL } from 'polarkit/hooks'
import { ReactElement } from 'react'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()
  const { organization: orgSlug, repo: repoSlug } = router.query
  const key = `orgrepo-${orgSlug}-${repoSlug}` // use key to force reload of state
  const { org, repo, isLoaded, haveOrgs } = useCurrentOrgAndRepoFromURL()
  if (!isLoaded) {
    return <></>
  }
  if (isLoaded && !org && !repo) {
    router.push('/dashboard')
  }
  if (isLoaded && org && !repo) {
    router.push(`/dashboard/${org.name}`)
  }
  return <Dashboard key={key} org={org} repo={undefined} haveOrgs={haveOrgs} />
}

Page.getLayout = (page: ReactElement) => {
  return <>{page}</>
}

export default Page
