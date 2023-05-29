import InviteOnly from '@/components/Dashboard/Gatekeeper/InviteOnly'
import { useAuth } from '@/hooks/auth'
import { useUser } from 'polarkit/hooks'
import { useEffect } from 'react'
import AcceptTerms from './AcceptTerms'

const Gatekeeper = (props: { children: React.ReactElement }) => {
  const { currentUser, reloadUser } = useAuth()
  const user = useUser()

  useEffect(() => {
    if (user.failureReason?.status === 401) {
      reloadUser()
    }
  }, [user, reloadUser])

  if (currentUser && !currentUser.invite_only_approved) {
    return <InviteOnly />
  }

  if (currentUser && !currentUser.accepted_terms_of_service) {
    return <AcceptTerms />
  }

  return props.children
}

export default Gatekeeper
