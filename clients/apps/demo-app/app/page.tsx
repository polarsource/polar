import { getExternalCustomerId, logout } from './actions'
import { getProPrice, getTopUps, isPro } from '../polar'
import { Demo } from './demo'
import { highlightSteps } from './highlight'
import { Login } from './login'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ checkout_id?: string }>
}) {
  const externalId = await getExternalCustomerId()
  if (!externalId) {
    return <Login snippets={await highlightSteps()} />
  }

  const [proPrice, pro, topUps, snippets] = await Promise.all([
    getProPrice(),
    isPro(externalId),
    getTopUps(),
    highlightSteps(),
  ])

  return (
    <>
      <Demo
        externalCustomerId={externalId}
        proPrice={proPrice}
        pro={pro}
        topUps={topUps}
        upgrading={(await searchParams).checkout_id !== undefined}
        snippets={snippets}
      />
      <form action={logout} className="logout">
        <button type="submit" className="ghost">
          Log out
        </button>
      </form>
    </>
  )
}
