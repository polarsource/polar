import Dashboard from '@/components/Dashboard'
import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import { useToast } from '@/components/UI/Toast/use-toast'
import type { NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { ReactElement, useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../../hooks'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()
  const { organization: orgSlug, repo: repoSlug, status } = router.query
  const { toast } = useToast()
  const { org, repo, isLoaded } = useCurrentOrgAndRepoFromURL()
  const key = `org-${orgSlug}-repo-${repoSlug}` // use key to force reload of state

  useEffect(() => {
    // TODO: Redirect to backer view
    if (isLoaded && !org) {
      router.push('/issues')
      return
    }
  }, [isLoaded, org, router])

  useEffect(() => {
    if (status === 'stripe-connected') {
      toast({
        title: 'Stripe setup complete',
        description: 'Your account is now ready to accept pledges.',
      })
    }
  }, [status, toast])

  if (!isLoaded) {
    return <></>
  }

  return (
    <>
      <Head>
        <title>Polar{org ? ` ${org.name}` : ''}</title>
      </Head>
      <Dashboard
        key={key}
        org={org}
        repo={repo}
        isPersonal={false}
        isDependencies={false}
      />
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
