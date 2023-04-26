import Dashboard from 'components/Dashboard/Dashboard'
import InviteOnly from 'components/Dashboard/InviteOnly'
import type { NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { ReactElement, useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL, useRequireAuth } from '../../../hooks'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()
  const { organization } = router.query
  const key = `org-${organization}` // use key to force reload of state
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()
  const { currentUser } = useRequireAuth()

  useEffect(() => {
    if (isLoaded && !org) {
      router.push('/dashboard')
      return
    }
  }, [isLoaded, org])

  if (currentUser && !currentUser.invite_only_approved) {
    return <InviteOnly />
  }

  if (!isLoaded) {
    return <></>
  }

  return (
    <>
      <Head>
        <title>Polar {org.name}</title>
      </Head>
      <Dashboard key={key} org={org} repo={undefined} isPersonal={false} />
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <>{page}</>
}

export default Page
