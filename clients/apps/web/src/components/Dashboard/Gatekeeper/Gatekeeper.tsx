import InviteOnly from '@/components/Dashboard/Gatekeeper/InviteOnly'
import { useAuth } from '@/hooks'
import { useEffect, useState } from 'react'
import AcceptTerms from './AcceptTerms'

const Gatekeeper = (props: { children: React.ReactElement }) => {
  const { currentUser } = useAuth()

  // TODO: make use of serverside props instead, and we wouldn't need this workaround
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setReady(true)
  })

  if (!ready) {
    return <></>
  }

  if (!currentUser) {
    return <></>
  }

  if (!currentUser.invite_only_approved) {
    return <InviteOnly />
  }

  if (!currentUser.accepted_terms_of_service) {
    return <AcceptTerms />
  }

  return props.children
}

export default Gatekeeper
