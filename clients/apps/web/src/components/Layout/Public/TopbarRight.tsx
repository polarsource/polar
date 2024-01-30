import GithubLoginButton from '@/components/Shared/GithubLoginButton'
import { ProfileMenu } from '@/components/Shared/ProfileSelection'
import { UserRead } from '@polar-sh/sdk'

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
