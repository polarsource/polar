import InviteOnly from '@/components/Dashboard/Gatekeeper/InviteOnly'
import { useRequireAuth } from '@/hooks/auth'
import AcceptTerms from './AcceptTerms'

const Gatekeeper = (props: { children: React.ReactElement }) => {
  let redirectPath = '/'
  if (typeof window !== 'undefined') {
    const currentURL = new URL(window.location.href)
    const redirectURL = new URL(window.location.origin + redirectPath)

    if (currentURL.pathname !== redirectPath) {
      redirectURL.searchParams.set(
        'goto_url',
        currentURL.toString().replace(window.location.origin, ''),
      )
      redirectPath = redirectURL.toString()
    }
  }

  const { currentUser } = useRequireAuth(redirectPath)

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
