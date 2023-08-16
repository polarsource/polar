import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import type { NextLayoutComponentType } from 'next'
import { useRouter } from 'next/router'
import { ReactElement, useEffect } from 'react'

const Page: NextLayoutComponentType = () => {
  const router = useRouter()

  useEffect(() => {
    router.push(`/feed`)
  })
}

Page.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default Page
