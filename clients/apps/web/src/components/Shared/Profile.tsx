import React from 'react'
import { useAuth } from 'polarkit/hooks'

const Profile = () => {
  const { authenticated, user, logout } = useAuth()
  if (!authenticated) {
    // TODO: Switch to <Link> or can we use that even in Dashboard (pure)?
    return <a href="/login">Login</a>
  }

  const handleLogout = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    logout()
  }

  return (
    <>
      <div className="flex items-center">
        <img
          className="h-8 w-8 rounded-full"
          src={user.profile.avatar_url}
          alt=""
        />
        <a href="#" className="ml-3" onClick={handleLogout}>
          Logout
        </a>
      </div>
    </>
  )
}

export default Profile
