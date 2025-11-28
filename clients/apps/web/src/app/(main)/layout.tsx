import { CookieConsent } from '@/components/Privacy/CookieConsent'
import { headers } from 'next/headers'
import { PropsWithChildren } from 'react'
import { PolarThemeProvider } from '../providers'

export default async function Layout({ children }: PropsWithChildren) {
  const headersList = await headers()
  const countryCode = headersList.get('x-vercel-ip-country')

  return (
    <PolarThemeProvider>
      <div className="dark:bg-polar-950 h-full bg-white dark:text-white">
        {children}
        <CookieConsent countryCode={countryCode} />
      </div>
    </PolarThemeProvider>
  )
}
