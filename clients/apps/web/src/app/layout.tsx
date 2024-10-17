import '../styles/globals.scss'

import { CookieConsent } from '@/components/Privacy/CookieConsent'
import SandboxBanner from '@/components/Sandbox/SandboxBanner'
import { UserContextProvider } from '@/providers/auth'
import { getServerSideAPI } from '@/utils/api/serverside'
import { getAuthenticatedUser, getUserOrganizations } from '@/utils/user'
import { Organization, UserRead } from '@polar-sh/sdk'
import { GeistSans } from 'geist/font/sans'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import { Metadata } from 'next/types'
import { twMerge } from 'tailwind-merge'
import {
  PolarPostHogProvider,
  PolarQueryClientProvider,
  PolarThemeProvider,
  PolarToploaderProvider,
} from './providers'

export const metadata: Metadata = {
  title: {
    template: '%s | Polar',
    default: 'Polar',
  },
  description: 'The best monetization platform for developers',
  openGraph: {
    images: 'https://polar.sh/assets/brand/polar_og.jpg',
    type: 'website',
    title: 'Polar - The best monetization platform for developers',
    siteName: 'Polar',
    description: 'The best monetization platform for developers',
  },
  twitter: {
    images: 'https://polar.sh/assets/brand/polar_og.jpg',
    card: 'summary_large_image',
    title: 'Polar - The best monetization platform for developers',
    description: 'The best monetization platform for developers',
  },
  metadataBase: new URL('https://polar.sh/'),
}

export default async function RootLayout({
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
  children,
}: {
  children: React.ReactNode
}) {
  const api = getServerSideAPI()

  let authenticatedUser: UserRead | undefined = undefined
  let userOrganizations: Organization[] = []

  try {
    authenticatedUser = await getAuthenticatedUser(api)
    userOrganizations = await getUserOrganizations(api)
  } catch (e) {
    // Silently swallow errors during build, typically when rendering static pages
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
      throw e
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin={''}
        />
        <link
          href="/favicon.png"
          rel="icon"
          media="(prefers-color-scheme: dark)"
        ></link>
        <link
          href="/favicon-dark.png"
          rel="icon"
          media="(prefers-color-scheme: light)"
        ></link>
      </head>

      <body
        className={twMerge(
          `dark:bg-polar-950 h-full bg-gray-100 [font-feature-settings:'ss03','zero'] md:h-screen dark:text-white`,
          GeistSans.className,
        )}
      >
        <UserContextProvider
          user={authenticatedUser}
          userOrganizations={userOrganizations}
        >
          <PolarPostHogProvider>
            <PolarThemeProvider>
              <PolarToploaderProvider>
                <PolarQueryClientProvider>
                  <>
                    <SandboxBanner />
                    {children}
                    <CookieConsent />
                  </>
                </PolarQueryClientProvider>
              </PolarToploaderProvider>
            </PolarThemeProvider>
          </PolarPostHogProvider>
        </UserContextProvider>
      </body>
    </html>
  )
}
