import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import type { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { ReactElement, useEffect } from 'react'

/**
 * TODO: Delete me in October, 2023
 *
 * I used to be a route, now I'm a mere redirect.
 * You can remove me ~1 month from now to clean up the codebase.
 */
const Page: NextLayoutComponentType = () => {
  const router = useRouter()

  useEffect(() => {
    router.push(`/feed`)
  }, [router])

  return <></>
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
