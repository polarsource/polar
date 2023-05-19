import Dashboard from '@/components/Dashboard'
import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import type { NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { ReactElement, useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../../hooks'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()
  const { organization: orgSlug, repo: repoSlug } = router.query
  const key = `orgrepo-${orgSlug}-${repoSlug}` // use key to force reload of state
  const { org, repo, isLoaded } = useCurrentOrgAndRepoFromURL()

  useEffect(() => {
    if (isLoaded && !org && !repo) {
      router.push('/dashboard')
      return
    }
    if (isLoaded && org && !repo) {
      router.push(`/dashboard/${org.name}`)
      return
    }
  }, [isLoaded, org, repo])

  if (!isLoaded) {
    return <></>
  }

  return (
    <>
      <Head>
        <title>Polar{org && repo ? ` ${org.name}/${repo.name}` : ''}</title>
      </Head>
      <Dashboard key={key} org={org} repo={repo} isPersonal={false} />
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
