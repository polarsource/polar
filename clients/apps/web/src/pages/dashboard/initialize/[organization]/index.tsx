import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import LoadingScreen from '@/components/Dashboard/LoadingScreen'
import { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { ReactElement, useEffect } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../../hooks'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  useEffect(() => {
    if (!isLoaded) return

    if (org) {
      router.push(`/maintainer/${org.name}/initialize`)
    }
    router.push('/feed')
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
