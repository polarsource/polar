import { useAuth } from 'polarkit/hooks'
import GithubLoginButton from './GithubLoginButton'
import Logout from './Logout'

const Profile = () => {
  const { authenticated } = useAuth()

  if (!authenticated) {
    return <GithubLoginButton />
  }

  return (
    <>
      <Logout />
    </>
  )
}

export default Profile
