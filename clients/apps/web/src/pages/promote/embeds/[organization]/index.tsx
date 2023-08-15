import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import LoadingScreen from '@/components/Dashboard/LoadingScreen'
import { useCurrentOrgAndRepoFromURL } from '@/hooks/org'
import { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { ReactElement, useEffect } from 'react'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  useEffect(() => {
    if (!isLoaded) return

    if (org) {
      router.push(`/maintainer/${org.name}/promote/embeds`)
      return
    }
    router.push(`/maintainer`)
  })

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
