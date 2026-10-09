import { getExternalCustomerId, login, logout } from './actions'
import { getProPrice, getTopUps, isPro } from '../polar'
import { Demo } from './demo'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ checkout_id?: string }>
}) {
  const externalId = await getExternalCustomerId()
  if (!externalId) {
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

  const [proPrice, pro, topUps] = await Promise.all([
    getProPrice(),
    isPro(externalId),
    getTopUps(),
  ])

  return (
    <>
      <Demo
        externalCustomerId={externalId}
        proPrice={proPrice}
        pro={pro}
        topUps={topUps}
        upgrading={(await searchParams).checkout_id !== undefined}
      />
      <form action={logout} className="logout">
        <button type="submit" className="ghost">
          Log out
        </button>
      </form>
    </>
  )
}
