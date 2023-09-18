'use client'

import { useRequireAuth } from '@/hooks'

const Gatekeeper = (props: { children: React.ReactElement }) => {
  const { currentUser } = useRequireAuth()

  if (!currentUser) {
    return <></>
  }

  return props.children
}

export default Gatekeeper
