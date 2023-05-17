import Dashboard from 'components/Dashboard/Dashboard'
import Gatekeeper from 'components/Dashboard/Gatekeeper/Gatekeeper'
import type { NextLayoutComponentType } from 'next'
import Head from 'next/head'
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

  return (
    <>
      <Head>
        <title>Polar{org ? ` ${org.name}` : ''}</title>
      </Head>
      <Dashboard key={key} org={org} repo={undefined} isPersonal={false} />
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
