'use client'

import { useAuth } from '@/hooks'

const Gatekeeper = (props: { children: React.ReactElement }) => {
  const { currentUser } = useAuth()

  if (!currentUser) {
    return <></>
  }

  return props.children
}

export default Gatekeeper
