import { BellIcon } from '@heroicons/react/24/outline'
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
      <BellIcon
        className="h-6 w-6 cursor-pointer text-gray-400 transition-colors duration-100 hover:text-gray-800"
        aria-hidden="true"
      />
      <Logout />
    </>
  )
}

export default Profile
