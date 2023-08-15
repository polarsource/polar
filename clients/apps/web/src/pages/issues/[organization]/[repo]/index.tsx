import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import LoadingScreen from '@/components/Dashboard/LoadingScreen'
import type { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { ReactElement, useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../../hooks'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()
  const { organization: orgSlug, repo: repoSlug } = router.query
  const key = `orgrepo-${orgSlug}-${repoSlug}` // use key to force reload of state
  const { org, repo, isLoaded } = useCurrentOrgAndRepoFromURL()

  useEffect(() => {
    if (!isLoaded) return

    if (org && repo) {
      router.push(`/maintainer/${org.name}/issues?repo=${repo.name}`)
      return
    }

    if (org) {
      router.push(`/maintainer/${org.name}/issues`)
      return
    }

    // TODO: Redirect to backer view
    router.push('/dependencies/personal')
  }, [isLoaded, org, repo, router])

  return (
    <>
      <LoadingScreen>
        <>Redirecting...</>
      </LoadingScreen>
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
