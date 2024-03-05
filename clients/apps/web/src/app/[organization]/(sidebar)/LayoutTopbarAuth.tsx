import PublicProfileDropdown from '@/components/Navigation/PublicProfileDropdown'
import { UserRead } from '@polar-sh/sdk'
import LayoutTopbarGitHubLogin from './LayoutTopbarGitHubLogin'

const LayoutTopbarAuth = (props: {
  authenticatedUser: UserRead | undefined
}) => {
  if (props.authenticatedUser) {
    return (
      <PublicProfileDropdown
        className="z-50"
        authenticatedUser={props.authenticatedUser}
      />
    )
  }

  return <LayoutTopbarGitHubLogin />
}

export default LayoutTopbarAuth
