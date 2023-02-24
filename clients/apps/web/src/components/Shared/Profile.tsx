import { useAuth } from 'polarkit/hooks'

const Profile = () => {
  const { authenticated, user } = useAuth()
  if (!authenticated) {
    // TODO: Switch to <Link> or can we use that even in Dashboard (pure)?
    return <a href="/login">Login</a>
  }

  return (
    <>
      <div className="flex items-center">
        <img
          className="h-8 w-8 rounded-full"
          src={user.profile.avatar_url}
          alt=""
        />
      </div>
    </>
  )
}

export default Profile
