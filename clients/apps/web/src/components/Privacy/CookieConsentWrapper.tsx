import { headers } from 'next/headers'
import { CookieConsent } from './CookieConsent'

export async function CookieConsentWrapper() {
  const headersList = await headers()
  const continent = headersList.get('x-polar-user-continent') === 'EU'

  return <CookieConsent continent={continent} />
}
