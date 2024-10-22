import { CookieConsent } from '@/components/Privacy/CookieConsent'
import { PropsWithChildren } from 'react'
import { PolarThemeProvider } from '../providers'

export default async function Layout({ children }: PropsWithChildren) {
  return (
    <PolarThemeProvider>
      <div className="dark:bg-polar-950 h-full md:h-screen bg-gray-100 dark:text-white">
        {children}
        <CookieConsent />
      </div>
    </PolarThemeProvider>
  )
}
