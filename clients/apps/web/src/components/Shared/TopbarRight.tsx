import { UserRead } from '@polar-sh/sdk'
import GithubLoginButton from './GithubLoginButton'
import { ProfileMenu } from './ProfileSelection'

const TopbarRight = ({
  authenticatedUser,
}: {
  authenticatedUser?: UserRead
}) => {
  return (
    <>
      {authenticatedUser ? (
        <ProfileMenu authenticatedUser={authenticatedUser} />
      ) : (
        <GithubLoginButton text="Continue with GitHub" />
      )}
    </>
  )
}

export default TopbarRight
