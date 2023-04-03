import Link from 'next/link'
import { useAuth } from 'polarkit/hooks'
import Logout from './Logout'

const Profile = () => {
  const { authenticated, currentUser, logout } = useAuth()

  if (!authenticated) {
    return <Link href="/login">Login</Link>
  }

  return (
    <>
      <Logout />
    </>
  )
}

export default Profile
