'use client'

import { useRequireAuth } from '@/hooks'
import AcceptTerms from './AcceptTerms'

const Gatekeeper = (props: { children: React.ReactElement }) => {
  const { currentUser } = useRequireAuth()

  if (!currentUser) {
    return <></>
  }

  if (!currentUser.accepted_terms_of_service) {
    return <AcceptTerms />
  }

  return props.children
}

export default Gatekeeper
