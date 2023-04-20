import Dashboard from 'components/Dashboard/Dashboard'
import type { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { ReactElement, useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../../hooks'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()
  const { organization: orgSlug, repo: repoSlug } = router.query
  const key = `orgrepo-${orgSlug}-${repoSlug}` // use key to force reload of state
  const { org, repo, isLoaded, haveOrgs } = useCurrentOrgAndRepoFromURL()

  useEffect(() => {
    if (isLoaded && !org && !repo) {
      console.log('org repo to /dash')
      router.push('/dashboard')
      return
    }
    if (isLoaded && org && !repo) {
      console.log('/org repo to /org')
      router.push(`/dashboard/${org.name}`)
      return
    }
  }, [isLoaded, org, repo])

  if (!isLoaded) {
    return <></>
  }

  return <Dashboard key={key} org={org} repo={undefined} isPersonal={false} />
}

Page.getLayout = (page: ReactElement) => {
  return <>{page}</>
}

export default Page
