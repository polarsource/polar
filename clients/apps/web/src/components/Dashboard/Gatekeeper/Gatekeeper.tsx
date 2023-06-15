import InviteOnly from '@/components/Dashboard/Gatekeeper/InviteOnly'
import { useRequireAuth } from '@/hooks'
import AcceptTerms from './AcceptTerms'

const Gatekeeper = (props: { children: React.ReactElement }) => {
  const { currentUser } = useRequireAuth()

  if (!currentUser) {
    return <></>
  }

  const requireInvite = false // Do not require invites! Anyone can sign up now. :-)
  if (requireInvite && !currentUser.invite_only_approved) {
    return <InviteOnly />
  }

  if (!currentUser.accepted_terms_of_service) {
    return <AcceptTerms />
  }

  return props.children
}

export default Gatekeeper
