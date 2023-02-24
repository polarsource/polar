import { useAuth } from 'polarkit/context/auth'

const Profile = () => {
  const { session } = useAuth()

  if (!session.authenticated) {
    // TODO: Switch to <Link> or can we use that even in Dashboard (pure)?
    return <a href="/login">Login</a>
  }

  return (
    <>
      <div className="flex items-center">
        <img
          className="h-8 w-8 rounded-full"
          src={session.user.profile.avatar_url}
          alt=""
        />
      </div>
    </>
  )
}

export default Profile
