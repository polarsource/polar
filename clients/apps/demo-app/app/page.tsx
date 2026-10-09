import { getExternalCustomerId, login, logout } from './actions'
import { Demo } from './demo'

export const dynamic = 'force-dynamic'

export default async function Page() {
  if (!(await getExternalCustomerId())) {
    return (
      <form action={login} className="card">
        <div>
          <h1>Log in</h1>
          <p className="muted">Any email works. No password needed.</p>
        </div>
        <input name="email" type="email" placeholder="you@example.com" required />
        <button type="submit" className="primary">
          Continue
        </button>
      </form>
    )
  }

  return (
    <>
      <Demo />
      <form action={logout} className="logout">
        <button type="submit" className="ghost">
          Log out
        </button>
      </form>
    </>
  )
}
