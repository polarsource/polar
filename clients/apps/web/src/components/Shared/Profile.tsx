import { useAuth } from '../../hooks'
import GithubLoginButton from './GithubLoginButton'
import ProfileSelection from './ProfileSelection'

const Profile = () => {
  const { authenticated } = useAuth()

  if (!authenticated) {
    return <GithubLoginButton />
  }

  return <ProfileSelection />
}
export default Profile
