import { ProfileMenu } from '@/components/Shared/ProfileSelection'
import { UserRead } from '@polar-sh/sdk'
import LayoutTopbarGitHubLogin from './LayoutTopbarGitHubLogin'

const LayoutTopbarAuth = (props: {
  authenticatedUser: UserRead | undefined
}) => {
  if (props.authenticatedUser) {
    return (
      <ProfileMenu
        className="z-50"
        authenticatedUser={props.authenticatedUser}
      />
    )
  }

  return <LayoutTopbarGitHubLogin />
}

export default LayoutTopbarAuth
